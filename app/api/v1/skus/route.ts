import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { skus } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic"; // DB-backed; cache via response header


export async function GET() {
  try {
    const rows = await db
      .select({
        code: skus.code,
        family: skus.family,
        familyName: skus.familyName,
        tier: skus.tier,
        description: skus.description,
        heightInches: skus.heightInches,
        basePricePerLfCents: skus.basePricePerLfCents,
        heroImageUrl: skus.heroImageUrl,
        specBullets: skus.specBullets,
        sortOrder: skus.sortOrder,
      })
      .from(skus)
      .where(eq(skus.active, true))
      .orderBy(skus.sortOrder);

    const res = NextResponse.json(rows);
    res.headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
    return res;
  } catch (err) {
    console.error("skus GET error", err);
    return serverError();
  }
}
