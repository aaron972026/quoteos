"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { pricingVersions, skus } from "@/lib/db/schema";
import { invalidatePricingConfigCache } from "@/lib/pricing/load-config";

const PricingFields = z.object({
  description: z.string().min(1).max(512),
  base_price_per_lf_cents: z.number().int().min(0).max(1_000_000),
  material_cost_per_lf_cents: z.number().int().min(0).max(1_000_000),
  labor_cost_per_lf_cents: z.number().int().min(0).max(1_000_000),
  market_max_per_lf_cents: z.number().int().min(0).max(1_000_000).nullable(),
  spec_bullets: z.array(z.string().min(1).max(160)).max(12),
  hero_image_url: z.string().url().nullable(),
  active: z.boolean(),
});

const IdentityFields = z.object({
  code: z.string().regex(/^[A-Z0-9-]{2,16}$/),
  family: z.string().regex(/^[A-Z0-9]{2,8}$/),
  family_name: z.string().min(2).max(64),
  height_inches: z.number().int().min(24).max(120),
  tier: z.enum(["good", "better", "best"]).nullable(),
});

function parseDollarsToCents(raw: FormDataEntryValue | null): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Invalid currency amount");
  }
  return Math.round(n * 100);
}

function parseOptionalDollarsToCents(
  raw: FormDataEntryValue | null
): number | null {
  const s = (raw ?? "").toString().trim();
  if (s === "") return null;
  return parseDollarsToCents(s);
}

function parsePricingFields(formData: FormData): z.infer<typeof PricingFields> {
  const bulletsRaw = (formData.get("spec_bullets") ?? "").toString();
  const bullets = bulletsRaw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const heroRaw = (formData.get("hero_image_url") ?? "").toString().trim();

  return PricingFields.parse({
    description: formData.get("description")?.toString() ?? "",
    base_price_per_lf_cents: parseDollarsToCents(
      formData.get("base_price_per_lf_dollars")
    ),
    material_cost_per_lf_cents: parseDollarsToCents(
      formData.get("material_cost_per_lf_dollars")
    ),
    labor_cost_per_lf_cents: parseDollarsToCents(
      formData.get("labor_cost_per_lf_dollars")
    ),
    market_max_per_lf_cents: parseOptionalDollarsToCents(
      formData.get("market_max_per_lf_dollars")
    ),
    spec_bullets: bullets,
    hero_image_url: heroRaw === "" ? null : heroRaw,
    active: formData.get("active") === "on",
  });
}

function computedMarketFlag(
  baseCents: number,
  marketMaxCents: number | null
): "ok" | "ABOVE_MKT" {
  return marketMaxCents != null && baseCents > marketMaxCents
    ? "ABOVE_MKT"
    : "ok";
}

function errMessage(err: unknown): string {
  return err instanceof z.ZodError
    ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    : err instanceof Error
      ? err.message
      : "Validation failed";
}

export interface UpdateSkuResult {
  ok: boolean;
  error?: string;
}

/**
 * Server action invoked by SkuEditForm (edit mode). Validates, writes the
 * change, and appends a pricing_versions audit row with before+after.
 * Cache busted after the write so the next quote calculation sees the new
 * SKU values immediately — see lib/pricing/load-config.ts (DB-backed).
 */
export async function updateSku(
  code: string,
  formData: FormData
): Promise<UpdateSkuResult> {
  const before = (
    await db.select().from(skus).where(eq(skus.code, code)).limit(1)
  )[0];
  if (!before) return { ok: false, error: `SKU ${code} not found` };

  let parsed: z.infer<typeof PricingFields>;
  try {
    parsed = parsePricingFields(formData);
  } catch (err) {
    return { ok: false, error: errMessage(err) };
  }

  await db
    .update(skus)
    .set({
      description: parsed.description,
      basePricePerLfCents: parsed.base_price_per_lf_cents,
      materialCostPerLfCents: parsed.material_cost_per_lf_cents,
      laborCostPerLfCents: parsed.labor_cost_per_lf_cents,
      marketMaxPerLfCents: parsed.market_max_per_lf_cents,
      marketFlag: computedMarketFlag(
        parsed.base_price_per_lf_cents,
        parsed.market_max_per_lf_cents
      ),
      specBullets: parsed.spec_bullets,
      heroImageUrl: parsed.hero_image_url,
      active: parsed.active,
    })
    .where(eq(skus.code, code));

  await db.insert(pricingVersions).values({
    versionNumber: `sku-${code}-${Date.now()}`,
    config: {
      kind: "sku_update",
      code,
      before,
      after: parsed,
    },
    effectiveAt: new Date(),
  });

  invalidatePricingConfigCache();

  revalidatePath("/admin/skus");
  revalidatePath(`/admin/skus/${code}/edit`);
  redirect("/admin/skus?saved=" + encodeURIComponent(code));
}

/**
 * Server action for /admin/skus/new — inserts a brand-new SKU (offering).
 * Same validation + audit + cache-bust contract as updateSku.
 */
export async function createSku(formData: FormData): Promise<UpdateSkuResult> {
  let identity: z.infer<typeof IdentityFields>;
  let parsed: z.infer<typeof PricingFields>;
  try {
    const tierRaw = (formData.get("tier") ?? "").toString().trim();
    identity = IdentityFields.parse({
      code: (formData.get("code") ?? "").toString().trim().toUpperCase(),
      family: (formData.get("family") ?? "").toString().trim().toUpperCase(),
      family_name: (formData.get("family_name") ?? "").toString().trim(),
      height_inches: Number(formData.get("height_inches") ?? 0),
      tier: tierRaw === "" ? null : tierRaw,
    });
    parsed = parsePricingFields(formData);
  } catch (err) {
    return { ok: false, error: errMessage(err) };
  }

  const existing = (
    await db.select({ code: skus.code }).from(skus).where(eq(skus.code, identity.code)).limit(1)
  )[0];
  if (existing) {
    return { ok: false, error: `SKU ${identity.code} already exists` };
  }

  await db.insert(skus).values({
    code: identity.code,
    family: identity.family,
    familyName: identity.family_name,
    tier: identity.tier,
    description: parsed.description,
    heightInches: identity.height_inches,
    basePricePerLfCents: parsed.base_price_per_lf_cents,
    materialCostPerLfCents: parsed.material_cost_per_lf_cents,
    laborCostPerLfCents: parsed.labor_cost_per_lf_cents,
    subLaborPct: null,
    marketMaxPerLfCents: parsed.market_max_per_lf_cents,
    marketFlag: computedMarketFlag(
      parsed.base_price_per_lf_cents,
      parsed.market_max_per_lf_cents
    ),
    postsStandard: "cedar_wood",
    active: parsed.active,
    heroImageUrl: parsed.hero_image_url,
    specBullets: parsed.spec_bullets,
    sortOrder: 99,
  });

  await db.insert(pricingVersions).values({
    versionNumber: `sku-${identity.code}-create-${Date.now()}`,
    config: {
      kind: "sku_create",
      code: identity.code,
      after: { ...identity, ...parsed },
    },
    effectiveAt: new Date(),
  });

  invalidatePricingConfigCache();

  revalidatePath("/admin/skus");
  redirect("/admin/skus?saved=" + encodeURIComponent(identity.code));
}
