import { DEFAULT_PRICING_CONFIG, type PricingConfig } from "./data";

/**
 * Pricing-config loader.
 *
 * Slice 1 (current): returns the file-based DEFAULT_PRICING_CONFIG. The new
 * cost-up engine needs columns the existing `skus` table doesn't have yet:
 * `labor_cost_per_lf_cents`, `market_max_per_lf_cents`, `market_flag`,
 * `posts_standard`. Slice 2 will add those columns and re-enable DB-backed
 * config so admin SKU edits flow through to live quotes.
 *
 * The cache + invalidation hooks stay in place so the API routes don't have
 * to change when Slice 2 lands.
 */

const CACHE_TTL_MS = 60_000;
let cached: { config: PricingConfig; expiresAt: number } | null = null;

export async function loadPricingConfig(): Promise<PricingConfig> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.config;
  cached = { config: DEFAULT_PRICING_CONFIG, expiresAt: now + CACHE_TTL_MS };
  return DEFAULT_PRICING_CONFIG;
}

export function invalidatePricingConfigCache(): void {
  cached = null;
}
