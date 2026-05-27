/**
 * FRED (Federal Reserve Economic Data) thin client.
 * https://fred.stlouisfed.org/docs/api/fred/
 *
 * Fetches the latest N observations of a series (e.g. PPI for hardwood
 * lumber). Free API; get a key at https://fred.stlouisfed.org/docs/api/api_key.html
 * — set as FRED_API_KEY in env.
 *
 * Per-process LRU-style cache with a 1-hour TTL: FRED only refreshes monthly,
 * so admin page renders don't need to hit the network on every load. Cache
 * is keyed by (series_id, limit).
 */

export interface FredObservation {
  /** ISO date — typically the first day of the month for monthly series. */
  date: string;
  /** Numeric value, or null if the period reported "." (missing). */
  value: number | null;
}

export interface FredSuccess {
  ok: true;
  observations: FredObservation[];
}

export interface FredError {
  ok: false;
  code: "FRED_NOT_CONFIGURED" | "FRED_UPSTREAM" | "FRED_BAD_RESPONSE";
  message: string;
  status?: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { value: FredSuccess; expiresAt: number }>();

interface FredApiResponse {
  observations?: Array<{ date: string; value: string }>;
  error_code?: number;
  error_message?: string;
}

export async function getFredSeries(
  seriesId: string,
  limit = 13,
  signal?: AbortSignal
): Promise<FredSuccess | FredError> {
  const key = process.env.FRED_API_KEY;
  if (!key) {
    return {
      ok: false,
      code: "FRED_NOT_CONFIGURED",
      message: "FRED_API_KEY is not set. Get one at fred.stlouisfed.org.",
    };
  }

  const cacheKey = `${seriesId}::${limit}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.value;

  // sort_order=desc returns newest-first so we can compare obs[0] to obs[1]
  const url =
    `https://api.stlouisfed.org/fred/series/observations?` +
    `series_id=${encodeURIComponent(seriesId)}` +
    `&api_key=${encodeURIComponent(key)}` +
    `&file_type=json` +
    `&sort_order=desc` +
    `&limit=${limit}`;

  let r: Response;
  try {
    r = await fetch(url, { signal });
  } catch (err) {
    return {
      ok: false,
      code: "FRED_UPSTREAM",
      message: err instanceof Error ? err.message : "Network error calling FRED",
    };
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return {
      ok: false,
      code: "FRED_UPSTREAM",
      message: `FRED returned ${r.status}: ${text.slice(0, 240)}`,
      status: r.status,
    };
  }
  const json = (await r.json().catch(() => null)) as FredApiResponse | null;
  if (!json) {
    return {
      ok: false,
      code: "FRED_BAD_RESPONSE",
      message: "FRED returned non-JSON",
    };
  }
  if (json.error_code) {
    return {
      ok: false,
      code: "FRED_UPSTREAM",
      message: `FRED error ${json.error_code}: ${json.error_message ?? "unknown"}`,
    };
  }

  const observations: FredObservation[] = (json.observations ?? []).map((o) => ({
    date: o.date,
    // FRED returns "." for missing values
    value: o.value === "." ? null : Number(o.value),
  }));

  const success: FredSuccess = { ok: true, observations };
  cache.set(cacheKey, { value: success, expiresAt: now + CACHE_TTL_MS });
  return success;
}

/** Test-only — wipe the in-memory cache. */
export function __resetFredCache(): void {
  cache.clear();
}
