"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { pricingVersions, skus } from "@/lib/db/schema";
import { invalidatePricingConfigCache } from "@/lib/pricing/load-config";

const Schema = z.object({
  description: z.string().min(1).max(512),
  base_price_per_lf_cents: z.number().int().min(0).max(1_000_000),
  material_cost_per_lf_cents: z.number().int().min(0).max(1_000_000),
  sub_labor_pct: z.number().min(0).max(1),
  spec_bullets: z.array(z.string().min(1).max(160)).max(12),
  hero_image_url: z.string().url().nullable(),
  active: z.boolean(),
});

function parseDollarsToCents(raw: FormDataEntryValue | null): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Invalid currency amount");
  }
  return Math.round(n * 100);
}

function parsePct(raw: FormDataEntryValue | null): number {
  // Form input is shown as percentage (e.g. "23" or "23.5"); store as 0..1
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error("sub_labor_pct must be 0–100");
  }
  return n / 100;
}

export interface UpdateSkuResult {
  ok: boolean;
  error?: string;
}

/**
 * Server action invoked by SkuEditForm. Validates, writes the change, and
 * appends a pricing_versions audit row with before+after for trail purposes.
 * Cache busted after the write so the next quote calculation sees the new
 * SKU values — see lib/pricing/load-config.ts.
 */
export async function updateSku(
  code: string,
  formData: FormData
): Promise<UpdateSkuResult> {
  const before = (
    await db.select().from(skus).where(eq(skus.code, code)).limit(1)
  )[0];
  if (!before) return { ok: false, error: `SKU ${code} not found` };

  // Parse form values
  const bulletsRaw = (formData.get("spec_bullets") ?? "").toString();
  const bullets = bulletsRaw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const heroRaw = (formData.get("hero_image_url") ?? "").toString().trim();

  let parsed: z.infer<typeof Schema>;
  try {
    parsed = Schema.parse({
      description: formData.get("description")?.toString() ?? "",
      base_price_per_lf_cents: parseDollarsToCents(
        formData.get("base_price_per_lf_dollars")
      ),
      material_cost_per_lf_cents: parseDollarsToCents(
        formData.get("material_cost_per_lf_dollars")
      ),
      sub_labor_pct: parsePct(formData.get("sub_labor_pct_display")),
      spec_bullets: bullets,
      hero_image_url: heroRaw === "" ? null : heroRaw,
      active: formData.get("active") === "on",
    });
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : err instanceof Error
          ? err.message
          : "Validation failed";
    return { ok: false, error: msg };
  }

  // Persist the change + audit snapshot atomically (Drizzle doesn't ship
  // a transaction helper that's friendly to all driver shapes; sequentially
  // is fine here — admin operation, no contention).
  await db
    .update(skus)
    .set({
      description: parsed.description,
      basePricePerLfCents: parsed.base_price_per_lf_cents,
      materialCostPerLfCents: parsed.material_cost_per_lf_cents,
      subLaborPct: parsed.sub_labor_pct.toString(),
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

  // Bust the engine config cache so the next quote sees the new SKU values
  // immediately (otherwise the change would take up to CACHE_TTL_MS to land).
  invalidatePricingConfigCache();

  revalidatePath("/admin/skus");
  revalidatePath(`/admin/skus/${code}/edit`);
  redirect("/admin/skus?saved=" + encodeURIComponent(code));
}
