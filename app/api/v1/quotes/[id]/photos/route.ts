import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { quotes } from "@/lib/db/schema";
import {
  badRequest,
  notFound,
  ok,
  serverError,
  tooManyRequests,
  unauthorized,
} from "@/lib/api/respond";
import { LIMITS, checkLimit } from "@/lib/api/rate-limit";
import { getCurrentSessionId } from "@/lib/api/session-helper";
import {
  deleteObject,
  pathFromPublicUrl,
  uploadObject,
} from "@/lib/storage/supabase-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTOS = 3;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

interface PhotoRow {
  url: string;
  uploadedAt: string;
}

/**
 * POST: upload a single image, persist to quote.photo_urls, return the
 * updated array. Multipart form-data with a "file" field.
 *
 * AI audit is intentionally NOT wired here — that's the follow-up slice.
 * When it lands, fire-and-forget the audit call after the DB update and
 * populate quote.photo_audit asynchronously.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sid = await getCurrentSessionId();
  if (!sid) return unauthorized();

  const limit = checkLimit(
    `quote-photo:${sid}`,
    LIMITS.QUOTE_SAVE.max,
    LIMITS.QUOTE_SAVE.windowMs
  );
  if (!limit.allowed) return tooManyRequests();

  // Ownership check
  const [row] = await db
    .select({ id: quotes.id, photoUrls: quotes.photoUrls })
    .from(quotes)
    .where(and(eq(quotes.id, params.id), eq(quotes.sessionId, sid)))
    .limit(1);
  if (!row) return notFound("Quote not found");

  const existing: PhotoRow[] = (row.photoUrls as PhotoRow[] | null) ?? [];
  if (existing.length >= MAX_PHOTOS) {
    return badRequest(
      "TOO_MANY_PHOTOS",
      `Maximum ${MAX_PHOTOS} photos per quote.`
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("INVALID_FORM", "Expected multipart/form-data body");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return badRequest("FILE_MISSING", "Form field 'file' is required");
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return badRequest(
      "UNSUPPORTED_TYPE",
      `Got ${file.type || "unknown"}. Allowed: ${Array.from(ALLOWED_TYPES).join(", ")}`
    );
  }
  if (file.size === 0) {
    return badRequest("EMPTY_FILE", "File is empty");
  }
  if (file.size > MAX_BYTES) {
    return badRequest(
      "FILE_TOO_LARGE",
      `Max ${Math.round(MAX_BYTES / 1024 / 1024)} MB; got ${(file.size / 1024 / 1024).toFixed(1)} MB`
    );
  }

  const ext = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase().slice(0, 8)
    : "jpg";
  const safeName = `yard-${existing.length + 1}.${ext}`;
  const buffer = await file.arrayBuffer();

  const upload = await uploadObject(params.id, safeName, file.type, buffer);
  if ("ok" in upload && upload.ok === false) {
    if (upload.code === "STORAGE_NOT_CONFIGURED") {
      return new Response(
        JSON.stringify({
          error: { code: upload.code, message: upload.message },
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
    console.error("[quote-photos] upload failed", upload);
    return serverError(upload.message);
  }

  const photoRow: PhotoRow = {
    url: upload.publicUrl,
    uploadedAt: new Date().toISOString(),
  };
  const nextPhotos = [...existing, photoRow];

  await db
    .update(quotes)
    .set({ photoUrls: nextPhotos, updatedAt: new Date() })
    .where(eq(quotes.id, params.id));

  // TODO (next slice): kick off AI audit asynchronously here.
  //   queueMicrotask(() => runPhotoAudit(params.id, nextPhotos));

  return ok({ photo_urls: nextPhotos });
}

/**
 * DELETE: remove a single photo by its public URL. Body: `{ url: "..." }`.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sid = await getCurrentSessionId();
  if (!sid) return unauthorized();

  const body = await req.json().catch(() => null);
  const url = body?.url;
  if (typeof url !== "string" || !url) {
    return badRequest("URL_REQUIRED", "Body must include { url }");
  }

  const [row] = await db
    .select({ id: quotes.id, photoUrls: quotes.photoUrls })
    .from(quotes)
    .where(and(eq(quotes.id, params.id), eq(quotes.sessionId, sid)))
    .limit(1);
  if (!row) return notFound("Quote not found");

  const existing: PhotoRow[] = (row.photoUrls as PhotoRow[] | null) ?? [];
  const nextPhotos = existing.filter((p) => p.url !== url);
  if (nextPhotos.length === existing.length) {
    return badRequest("PHOTO_NOT_FOUND", "URL is not on this quote");
  }

  // Best-effort storage cleanup. We persist the DB change regardless so a
  // stuck storage delete doesn't leave the user staring at a phantom thumb.
  const path = pathFromPublicUrl(url);
  if (path) {
    const del = await deleteObject(path);
    if ("ok" in del && del.ok === false) {
      console.warn("[quote-photos] storage delete failed", del);
    }
  }

  await db
    .update(quotes)
    .set({ photoUrls: nextPhotos, updatedAt: new Date() })
    .where(eq(quotes.id, params.id));

  return ok({ photo_urls: nextPhotos });
}
