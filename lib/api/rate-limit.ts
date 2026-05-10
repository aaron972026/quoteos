/**
 * Naïve in-memory token-bucket. Suitable for single-instance dev/POC.
 * For production swap to Upstash Redis or Cloudflare KV — same interface.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export interface LimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkLimit(
  key: string,
  max: number,
  windowMs: number
): LimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
  }
  if (b.count >= max) {
    return { allowed: false, remaining: 0, resetAt: b.resetAt };
  }
  b.count += 1;
  return { allowed: true, remaining: max - b.count, resetAt: b.resetAt };
}

// Common limits per spec §8
export const LIMITS = {
  PRICING: { max: 30, windowMs: 60_000 },
  QUOTE_SAVE: { max: 5, windowMs: 60_000 },
  DEPOSIT: { max: 1, windowMs: 60_000 },
  IP_GLOBAL: { max: 100, windowMs: 60_000 },
} as const;
