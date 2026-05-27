import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { skus } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { serverError } from "@/lib/api/respond";
import { SKU_BY_CODE } from "@/lib/pricing/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select({
        code: skus.code,
        family: skus.family,
        familyName: skus.familyName,
        // Tier slot (good/better/best) — drives the /configure tier-card layout
        // per family. Pricing-model v2 repurposed this column from multiplier
        // → slot label. Null on legacy rows that haven't been re-seeded yet.
        tier: skus.tier,
        description: skus.description,
        heightInches: skus.heightInches,
        basePricePerLfCents: skus.basePricePerLfCents,
        marketMaxPerLfCents: skus.marketMaxPerLfCents,
        marketFlag: skus.marketFlag,
        postsStandard: skus.postsStandard,
        heroImageUrl: skus.heroImageUrl,
        specBullets: skus.specBullets,
        sortOrder: skus.sortOrder,
      })
      .from(skus)
      .where(eq(skus.active, true))
      .orderBy(skus.sortOrder);

    // Enrich with friendly displayName from file constants (single source of
    // truth for customer-facing copy lives in lib/pricing/data.ts; the DB
    // doesn't have a display_name column yet).
    const enriched = rows.map((r) => ({
      ...r,
      displayName: SKU_BY_CODE[r.code]?.display_name ?? r.familyName,
    }));

    const res = NextResponse.json(enriched);
    res.headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
    return res;
  } catch (err) {
    console.error("skus GET error", err);
    return serverError();
  }
}
