/**
 * Seed pricing tables from lib/pricing/data.ts.
 * Idempotent — safe to re-run; uses ON CONFLICT for SKUs and wipes-and-fills
 * for adjustments + permits.
 *
 *   npm run db:seed   (uses .env.local)
 */
import { db } from "../lib/db/client";
import {
  adjustments,
  pricingVersions,
  serviceZones,
  skus,
} from "../lib/db/schema";
import {
  ADDONS,
  ASSUMPTIONS,
  DEMO_RATES,
  FINANCING,
  GATE_PRICES,
  PERMITS,
  SKUS,
  SLOPE,
} from "../lib/pricing/data";
import { eq, sql } from "drizzle-orm";

// SKU → tier slot mapping. Pricing v2 keeps the `tier` column on `skus`,
// repurposed from the old multiplier-tier to a slot label (good/better/best)
// that drives the /configure UI's family→tier card layout. Each family has
// 2 or 3 slots; not every family fills all three.
const LEGACY_TIER: Record<string, "good" | "better" | "best"> = {
  "BP-STD":   "good",
  "CPF-PRM":  "better",
  "CPF-EST":  "best",
  "HCF-STD":  "better",
  "HCF-PRM":  "best",
  "CL-RES":   "good",
  "CL-VIN":   "better",
  "RR-3":     "good",
  "RR-4":     "better",
};

async function seedSkus() {
  console.log(`→ Seeding ${SKUS.length} SKUs…`);

  // The pricing model changed shape (CP/HC/OR/CL/RR good/better/best → new 11-SKU set).
  // Delete the old SKU codes before inserting the new ones so the table reflects
  // only what the new engine knows about. Safe because no FKs reference skus.code.
  const newCodes = new Set(SKUS.map((s) => s.code));
  const existing = await db.select({ code: skus.code }).from(skus);
  for (const row of existing) {
    if (!newCodes.has(row.code)) {
      await db.delete(skus).where(eq(skus.code, row.code));
    }
  }

  for (const s of SKUS) {
    const tier = LEGACY_TIER[s.code] ?? null;

    await db
      .insert(skus)
      .values({
        code: s.code,
        family: s.family,
        familyName: s.family_name,
        tier,
        description: s.description,
        heightInches: s.height_inches,
        basePricePerLfCents: s.base_price_per_lf_cents,
        materialCostPerLfCents: s.material_cost_per_lf_cents,
        laborCostPerLfCents: s.labor_cost_per_lf_cents,
        subLaborPct: null,
        marketMaxPerLfCents: s.market_max_per_lf_cents,
        marketFlag: s.market_flag,
        postsStandard: s.posts_standard,
        active: true,
        heroImageUrl: s.hero_image_url,
        specBullets: s.spec_bullets,
        sortOrder: s.sort_order,
      })
      .onConflictDoUpdate({
        target: skus.code,
        set: {
          family: s.family,
          familyName: s.family_name,
          tier,
          description: s.description,
          heightInches: s.height_inches,
          basePricePerLfCents: s.base_price_per_lf_cents,
          materialCostPerLfCents: s.material_cost_per_lf_cents,
          laborCostPerLfCents: s.labor_cost_per_lf_cents,
          marketMaxPerLfCents: s.market_max_per_lf_cents,
          marketFlag: s.market_flag,
          postsStandard: s.posts_standard,
          // NOTE: `active` deliberately NOT in the update set. The admin
          // UI owns hide/show now (DB-backed pricing config) — re-running
          // the seed must never silently re-publish offerings the owner
          // hid in /admin/skus. New rows still insert active: true above.
          specBullets: s.spec_bullets,
          sortOrder: s.sort_order,
        },
      });
  }
  console.log(`  ${SKUS.length} SKUs inserted/updated`);
}

async function seedAdjustments() {
  console.log("→ Seeding adjustments (slope / demo / gates / addons / permits)…");

  await db.delete(adjustments);

  const rows: Array<{
    category: string;
    code: string;
    label: string;
    value: string;
    unit: string;
    metadata?: Record<string, unknown>;
  }> = [];

  // Slope (5 rows: codes 0..4)
  for (const [code, s] of Object.entries(SLOPE)) {
    rows.push({
      category: "slope",
      code: `slope_${code}`,
      label: s.label,
      value: s.surcharge_pct.toString(),
      unit: "surcharge_pct",
      metadata: { review_required: s.review_required },
    });
  }

  // Demo — single rate now ($3/LF for all demo types)
  for (const [type, rate] of Object.entries(DEMO_RATES)) {
    if (rate === 0) continue;
    rows.push({
      category: "demo",
      code: type,
      label: `Demo: ${type}`,
      value: rate.toString(),
      unit: "per_lf_cents",
    });
  }

  // Gates (W4, W5, D10, D12, D16)
  for (const [type, g] of Object.entries(GATE_PRICES)) {
    rows.push({
      category: "gate",
      code: type,
      label: g.label,
      value: g.price_cents.toString(),
      unit: "per_each_cents",
    });
  }

  // Add-ons
  rows.push(
    {
      category: "addon",
      code: "steel_upgrade",
      label: "Steel post upgrade (Cedar families only)",
      value: ADDONS.STEEL_UPGRADE_PER_LF_CENTS.toString(),
      unit: "per_lf_cents",
    },
    {
      category: "addon",
      code: "stain_seal",
      label: "Stain & Seal",
      value: ADDONS.STAIN_PER_LF_CENTS.toString(),
      unit: "per_lf_cents",
    },
    {
      category: "addon",
      code: "rock_drilling",
      label: "Rock / hard-clay drilling",
      value: ADDONS.ROCK_PER_POST_CENTS.toString(),
      unit: "per_post_cents",
    },
    {
      category: "addon",
      code: "tear_concrete",
      label: "Remove concrete-set old posts",
      value: ADDONS.TEAR_CONCRETE_PER_POST_CENTS.toString(),
      unit: "per_post_cents",
    },
    {
      category: "addon",
      code: "access",
      label: "Difficult access surcharge",
      value: ADDONS.ACCESS_SURCHARGE_PCT.toString(),
      unit: "surcharge_pct",
    }
  );

  // Permits by city
  for (const [city, cents] of Object.entries(PERMITS)) {
    rows.push({
      category: "permit",
      code: city,
      label: `${city} permit`,
      value: cents.toString(),
      unit: "flat_cents",
    });
  }

  // Assumptions snapshot (so admin can see the global knobs)
  for (const [key, value] of Object.entries(ASSUMPTIONS)) {
    rows.push({
      category: "assumption",
      code: key,
      label: key,
      value: value.toString(),
      unit: "raw",
    });
  }

  await db.insert(adjustments).values(rows);
  console.log(`  inserted ${rows.length} adjustment rows`);
}

async function seedServiceZones() {
  console.log("→ Seeding Tulsa metro service zones…");

  const primaryZips = [
    "74103", "74104", "74105", "74106", "74107", "74108",
    "74110", "74112", "74114", "74115", "74116", "74117", "74119",
    "74120", "74126", "74127", "74128", "74129", "74130", "74132",
    "74133", "74134", "74135", "74136", "74137", "74145", "74146",
  ];
  const extendedZips = [
    "74008", "74011", "74012", "74014", "74015", "74021", "74033",
    "74037", "74055", "74063", "74070", "74131", "74080",
  ];

  const rows: Array<{
    zip: string;
    city: string;
    state: string;
    inPrimary: boolean;
    inExtended: boolean;
    travelSurchargePerMileCents: number;
  }> = [];
  for (const zip of primaryZips) {
    rows.push({
      zip,
      city: "Tulsa",
      state: "OK",
      inPrimary: true,
      inExtended: false,
      travelSurchargePerMileCents: 0,
    });
  }
  for (const zip of extendedZips) {
    rows.push({
      zip,
      city: "Tulsa Metro",
      state: "OK",
      inPrimary: false,
      inExtended: true,
      travelSurchargePerMileCents: 0,
    });
  }

  for (const r of rows) {
    await db
      .insert(serviceZones)
      .values(r)
      .onConflictDoUpdate({
        target: serviceZones.zip,
        set: {
          inPrimary: r.inPrimary,
          inExtended: r.inExtended,
          travelSurchargePerMileCents: r.travelSurchargePerMileCents,
        },
      });
  }
  console.log(`  ${rows.length} zones`);
}

async function seedPricingVersion() {
  console.log("→ Recording pricing version snapshot…");

  const versionNumber = `v2.0-${new Date().toISOString().slice(0, 10)}`;
  const config = {
    assumptions: ASSUMPTIONS,
    skus: SKUS,
    slope: SLOPE,
    demo_rates: DEMO_RATES,
    gate_prices: GATE_PRICES,
    addons: ADDONS,
    permits: PERMITS,
    financing: FINANCING,
  };

  await db
    .insert(pricingVersions)
    .values({
      versionNumber,
      config: config as unknown as Record<string, unknown>,
      effectiveAt: new Date(),
    })
    .onConflictDoNothing();

  console.log(`  ${versionNumber}`);
}

async function main() {
  console.log("Seeding QuoteOS pricing data (v2 — cost-up engine)…");
  console.log(`DB: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@")}`);

  await db.execute(sql`SELECT 1`);

  await seedSkus();
  await seedAdjustments();
  await seedServiceZones();
  await seedPricingVersion();

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
