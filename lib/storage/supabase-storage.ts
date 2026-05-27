/**
 * Thin wrapper over the Supabase Storage REST API. We talk to it directly
 * instead of pulling in @supabase/supabase-js — keeps deps minimal and our
 * existing postgres-js DB client stays the only Supabase touchpoint.
 *
 * Setup expected in the project:
 *   1. A storage bucket (default name: "quote-photos") set to PUBLIC so the
 *      returned URLs render without signing every render.
 *   2. NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 *
 * If env is unset the helpers return a structured error rather than
 * throwing — the API route turns that into a 503 with a clear message
 * matching the rest of the codebase's "service unavailable" pattern.
 */

interface StorageConfig {
  ok: true;
  url: string;
  key: string;
  bucket: string;
}

export interface UploadResult {
  ok: true;
  publicUrl: string;
  path: string;
}

export interface StorageError {
  ok: false;
  code:
    | "STORAGE_NOT_CONFIGURED"
    | "STORAGE_UPSTREAM"
    | "STORAGE_BAD_RESPONSE";
  message: string;
  status?: number;
}

const FALLBACK_BUCKET = "quote-photos";

function getConfig(): StorageConfig | StorageError {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || FALLBACK_BUCKET;
  if (!url || !key) {
    return {
      ok: false,
      code: "STORAGE_NOT_CONFIGURED",
      message:
        "Supabase Storage not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local — see .env.example.",
    };
  }
  // Normalize: strip trailing slashes AND any service path the user may have
  // pasted (e.g. /rest/v1, /storage/v1). All Supabase services hang off the
  // project root, so we only want the host portion.
  const normalizedUrl = url
    .replace(/\/+$/, "")
    .replace(/\/(rest|storage|auth|realtime|functions)\/v\d+$/, "");
  return { ok: true, url: normalizedUrl, key, bucket };
}

/**
 * Upload a file to the configured bucket. Path is namespaced by quote id
 * to keep cleanup simple (a single DELETE request can wipe a quote's
 * folder).
 */
export async function uploadObject(
  quoteId: string,
  filename: string,
  contentType: string,
  body: ArrayBuffer
): Promise<UploadResult | StorageError> {
  const cfg = getConfig();
  if (cfg.ok === false) return cfg;

  const path = `${quoteId}/${Date.now()}-${filename}`;
  // Encode per segment — encodeURIComponent on the whole path would turn the
  // "/" separator into "%2F", which Supabase Storage interprets as a single
  // filename rather than a folder/file split.
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const endpoint = `${cfg.url}/storage/v1/object/${cfg.bucket}/${encodedPath}`;

  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      // Supabase requires BOTH apikey and Authorization headers for storage
      // REST calls — apikey alone isn't enough, and Authorization alone returns
      // "No `apikey` request header" (401).
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": contentType,
      "x-upsert": "false",
    },
    body,
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return {
      ok: false,
      code: "STORAGE_UPSTREAM",
      message: `Storage upload failed (${r.status}): ${text.slice(0, 240)}`,
      status: r.status,
    };
  }

  return {
    ok: true,
    publicUrl: `${cfg.url}/storage/v1/object/public/${cfg.bucket}/${encodedPath}`,
    path,
  };
}

/** Remove a previously uploaded object by its storage path. */
export async function deleteObject(
  path: string
): Promise<{ ok: true } | StorageError> {
  const cfg = getConfig();
  if (cfg.ok === false) return cfg;

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const endpoint = `${cfg.url}/storage/v1/object/${cfg.bucket}/${encodedPath}`;
  const r = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
    },
  });
  if (!r.ok && r.status !== 404) {
    const text = await r.text().catch(() => "");
    return {
      ok: false,
      code: "STORAGE_UPSTREAM",
      message: `Storage delete failed (${r.status}): ${text.slice(0, 240)}`,
      status: r.status,
    };
  }
  return { ok: true };
}

/**
 * Recover the storage path from a public URL we previously handed out.
 * Useful when only the URL is persisted on the quote row.
 */
export function pathFromPublicUrl(publicUrl: string): string | null {
  const cfg = getConfig();
  if (!("ok" in cfg) || cfg.ok === false) return null;
  const prefix = `${cfg.url}/storage/v1/object/public/${cfg.bucket}/`;
  if (!publicUrl.startsWith(prefix)) return null;
  try {
    // Per-segment decode preserves the "/" separators that the per-segment
    // encoder left untouched on upload.
    return publicUrl
      .slice(prefix.length)
      .split("/")
      .map(decodeURIComponent)
      .join("/");
  } catch {
    return null;
  }
}
