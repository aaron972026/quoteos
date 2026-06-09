import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { skus } from "@/lib/db/schema";
import {
  DEFAULT_PRICING_CONFIG,
  SKU_BY_CODE,
  type PricingConfig,
  type SkuData,
} from "./data";
import type { SkuFamily } from "./types";

/**
 * Pricing-config loader — Slice 2 (DB-backed SKUs).
 *
 * SKU rows (prices, costs, active flag, market caps) are read from the
 * `skus` table, so edits made in /admin/skus flow to live quotes within
 * CACHE_TTL_MS (or instantly — updateSku/createSku call
 * invalidatePricingConfigCache after every save).
 *
 * Per-row gaps fall back to the file constants by code (display_name has
 * no DB column yet; legacy rows may miss v2 cost fields). Rows missing a
 * usable base price + material + labor are skipped rather than priced
 * wrong. If the DB is unreachable or empty, the whole config falls back
 * to the file-based DEFAULT_PRICING_CONFIG — a database blip must never
 * take quoting down.
 *
 * Still file-based (edit lib/pricing/data.ts + deploy to change):
 * assumptions, slope surcharges, demo rates, gate prices, add-ons,
 * permits, cost ratios, financing.
 */

const CACHE_TTL_MS = 60_000;
let cached: { config: PricingConfig; expiresAt: number } | null = null;

function rowToSkuData(row: typeof skus.$inferSelect): SkuData | null {
  const file = SKU_BY_CODE[row.code] as SkuData | undefined;

  const base = row.basePricePerLfCents ?? file?.base_price_per_lf_cents;
  const material =
    row.materialCostPerLfCents ?? file?.material_cost_per_lf_cents;
  const labor = row.laborCostPerLfCents ?? file?.labor_cost_per_lf_cents;
  if (base == null || material == null || labor == null) return null;

  const marketMax = row.marketMaxPerLfCents ?? file?.market_max_per_lf_cents;
  // Recompute the flag at load time so it stays truthful after price
  // edits (the stored column can go stale between saves).
  const market_flag: "ok" | "ABOVE_MKT" =
    marketMax != null && base > marketMax ? "ABOVE_MKT" : "ok";

  return {
    code: row.code,
    family: row.family as SkuFamily,
    family_name: row.familyName,
    display_name: file?.display_name ?? row.familyName,
    description: row.description,
    height_inches: row.heightInches,
    material_cost_per_lf_cents: material,
    labor_cost_per_lf_cents: labor,
    base_price_per_lf_cents: base,
    market_max_per_lf_cents: marketMax ?? base,
    market_flag,
    spec_bullets: row.specBullets ?? [],
    hero_image_url: row.heroImageUrl,
    sort_order: row.sortOrder,
    posts_standard:
      (row.postsStandard as SkuData["posts_standard"] | null) ??
      file?.posts_standard ??
      "cedar_wood",
  };
}

export async function loadPricingConfig(): Promise<PricingConfig> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.config;

  let config: PricingConfig = DEFAULT_PRICING_CONFIG;
  try {
    const rows = await db.select().from(skus).where(eq(skus.active, true));
    const skuByCode: Record<string, SkuData> = {};
    for (const row of rows) {
      const data = rowToSkuData(row);
      if (data) {
        skuByCode[data.code] = data;
      } else {
        console.warn(
          `[pricing] SKU ${row.code} missing price/cost fields — excluded from live config`
        );
      }
    }
    if (Object.keys(skuByCode).length > 0) {
      config = { ...DEFAULT_PRICING_CONFIG, skuByCode };
    } else {
      console.warn(
        "[pricing] skus table empty or unusable — serving file-based config"
      );
    }
  } catch (err) {
    console.error(
      "[pricing] DB config load failed — serving file-based config",
      err
    );
  }

  cached = { config, expiresAt: now + CACHE_TTL_MS };
  return config;
}

export function invalidatePricingConfigCache(): void {
  cached = null;
}
