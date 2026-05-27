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
import { runPhotoAudit } from "@/lib/ai/photo-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface PhotoRow {
  url: string;
  uploadedAt: string;
}

/**
 * POST: run a Claude vision audit over the quote's uploaded photos and store
 * the result in quote.photoAudit. Expensive — rate-limited to 1/min per
 * session (matches DEPOSIT). Returns the audit JSON to the caller.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sid = await getCurrentSessionId();
  if (!sid) return unauthorized();

  const limit = checkLimit(
    `quote-audit:${sid}`,
    LIMITS.DEPOSIT.max,
    LIMITS.DEPOSIT.windowMs
  );
  if (!limit.allowed) return tooManyRequests();

  const [row] = await db
    .select({
      id: quotes.id,
      photoUrls: quotes.photoUrls,
    })
    .from(quotes)
    .where(and(eq(quotes.id, params.id), eq(quotes.sessionId, sid)))
    .limit(1);
  if (!row) return notFound("Quote not found");

  const photos = (row.photoUrls as PhotoRow[] | null) ?? [];
  if (photos.length === 0) {
    return badRequest("NO_PHOTOS", "Upload at least one photo before auditing");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({
        error: {
          code: "ANTHROPIC_NOT_CONFIGURED",
          message:
            "Photo audit requires ANTHROPIC_API_KEY in .env.local — see .env.example.",
        },
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let audit;
  try {
    audit = await runPhotoAudit(photos.map((p) => p.url));
  } catch (err) {
    console.error("[quote-audit] vision call failed", err);
    const msg = err instanceof Error ? err.message : "Audit failed";
    return serverError(msg);
  }

  await db
    .update(quotes)
    .set({ photoAudit: audit, updatedAt: new Date() })
    .where(eq(quotes.id, params.id));

  return ok({ photo_audit: audit });
}
