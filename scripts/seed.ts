/**
 * Seed pricing tables from lib/pricing/data.ts.
 * Idempotent — safe to re-run; uses ON CONFLICT.
 *
 *   pnpm run db:seed   (uses .env.local)
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
  DEMO_RATES,
  FINANCING,
  GATE_PRICES,
  SKUS,
  SLOPE,
  TIER_MULTIPLIERS,
} from "../lib/pricing/data";
import { sql } from "drizzle-orm";

async function seedSkus() {
  console.log(`→ Seeding ${SKUS.length} SKUs…`);
  for (const s of SKUS) {
    await db
      .insert(skus)
      .values({
        code: s.code,
        family: s.family,
        familyName: s.family_name,
        tier: s.tier,
        description: s.description,
        heightInches: s.height_inches,
        basePricePerLfCents: s.base_price_per_lf_cents,
        materialCostPerLfCents: s.material_cost_per_lf_cents,
        subLaborPct: s.sub_labor_pct.toString(),
        active: true,
        heroImageUrl: s.hero_image_url,
        specBullets: s.spec_bullets,
        sortOrder: s.sort_order,
      })
      .onConflictDoUpdate({
        target: skus.code,
        set: {
          familyName: s.family_name,
          basePricePerLfCents: s.base_price_per_lf_cents,
          materialCostPerLfCents: s.material_cost_per_lf_cents,
          subLaborPct: s.sub_labor_pct.toString(),
          specBullets: s.spec_bullets,
        },
      });
  }
}

async function seedAdjustments() {
  console.log("→ Seeding adjustments (slope / demo / gates / addons / tiers)…");

  // Wipe existing then re-insert (this table has no business identity)
  await db.delete(adjustments);

  const rows: Array<{
    category: string;
    code: string;
    label: string;
    value: string;
    unit: string;
    metadata?: Record<string, unknown>;
  }> = [];

  // Slope
  for (const [code, s] of Object.entries(SLOPE)) {
    rows.push({
      category: "slope",
      code: `slope_${code}`,
      label: s.label,
      value: s.multiplier.toString(),
      unit: "multiplier",
    });
  }

  // Demo
  for (const [type, rate] of Object.entries(DEMO_RATES)) {
    rows.push({
      category: "demo",
      code: type,
      label: `Demo: ${type}`,
      value: rate.toString(),
      unit: "per_lf_cents",
    });
  }

  // Gates
  for (const [type, g] of Object.entries(GATE_PRICES)) {
    rows.push({
      category: "gate",
      code: type,
      label: g.label,
      value: g.price_cents.toString(),
      unit: "per_each_cents",
    });
  }

  // Tier multipliers
  for (const [tier, mul] of Object.entries(TIER_MULTIPLIERS)) {
    rows.push({
      category: "tier",
      code: tier,
      label: `Tier: ${tier}`,
      value: mul.toString(),
      unit: "multiplier",
    });
  }

  // Add-ons
  rows.push(
    {
      category: "addon",
      code: "stain_seal",
      label: "Stain & Seal",
      value: ADDONS.STAIN_PER_LF_CENTS.toString(),
      unit: "per_lf_cents",
    },
    {
      category: "addon",
      code: "french_gothic",
      label: "French Gothic top",
      value: ADDONS.FRENCH_GOTHIC_PER_LF_CENTS.toString(),
      unit: "per_lf_cents",
    },
    {
      category: "addon",
      code: "height_upgrade",
      label: "Height upgrade 6'→8' (CP/HC only)",
      value: ADDONS.HEIGHT_UPGRADE_PCT.toString(),
      unit: "pct",
    },
    {
      category: "addon",
      code: "corner_over",
      label: "Each corner over 4",
      value: ADDONS.CORNER_OVER_CENTS.toString(),
      unit: "per_each_cents",
    },
    {
      category: "addon",
      code: "permit",
      label: "Permit (when required)",
      value: ADDONS.PERMIT_FLAT_CENTS.toString(),
      unit: "flat_cents",
    },
    {
      category: "addon",
      code: "hoa_admin",
      label: "HOA admin fee",
      value: ADDONS.HOA_ADMIN_FLAT_CENTS.toString(),
      unit: "flat_cents",
    },
    {
      category: "addon",
      code: "travel",
      label: "Travel >25 mi",
      value: ADDONS.TRAVEL_PER_MILE_CENTS.toString(),
      unit: "per_mile_cents",
    }
  );

  await db.insert(adjustments).values(rows);
  console.log(`  inserted ${rows.length} adjustment rows`);
}

async function seedServiceZones() {
  console.log("→ Seeding Tulsa metro service zones…");

  // Tulsa metro core (primary). Source: standard Tulsa OK zip list.
  const primaryZips = [
    "74103", "74104", "74105", "74106", "74107", "74108",
    "74110", "74112", "74114", "74115", "74116", "74117", "74119",
    "74120", "74126", "74127", "74128", "74129", "74130", "74132",
    "74133", "74134", "74135", "74136", "74137", "74145", "74146",
  ];
  const extendedZips = [
    "74008", "74011", "74012", "74014", "74015", "74021", "74033",
    "74037", "74055", "74063", "74070", "74131", "74055", "74080",
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
      travelSurchargePerMileCents: ADDONS.TRAVEL_PER_MILE_CENTS,
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

  const versionNumber = `v1.0-${new Date().toISOString().slice(0, 10)}`;
  const config = {
    skus: SKUS,
    slope: SLOPE,
    demo_rates: DEMO_RATES,
    gate_prices: GATE_PRICES,
    tier_multipliers: TIER_MULTIPLIERS,
    addons: ADDONS,
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
  console.log("Seeding QuoteOS pricing data…");
  console.log(`DB: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@")}`);

  await db.execute(sql`SELECT 1`); // sanity check

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
