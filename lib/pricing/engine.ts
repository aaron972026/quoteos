import {
  ADDONS,
  DEMO_RATES,
  FINANCING,
  GATE_PRICES,
  HEIGHT_UPGRADE_FAMILIES,
  LF_LIMITS,
  MARGIN_THRESHOLDS,
  SKU_BY_CODE,
  SLOPE,
  TIER_MULTIPLIERS,
} from "./data";
import {
  type InternalMargin,
  type MarginFlag,
  PricingError,
  type PricingInput,
  type PricingResult,
  type Tier,
} from "./types";

/**
 * Pure pricing engine. Same input → same output, no side effects.
 * Money in cents (integer). Single source of truth — see spec §5.
 */
export function calculatePrice(input: PricingInput): PricingResult {
  const warnings: string[] = [];
  const sku = SKU_BY_CODE[input.sku_code];
  if (!sku) throw new PricingError("UNKNOWN_SKU", `SKU not found: ${input.sku_code}`);

  // ─── Validation ───────────────────────────────────────────────────
  if (!Number.isFinite(input.linear_feet) || input.linear_feet <= 0) {
    throw new PricingError("INVALID_LF", "linear_feet must be > 0");
  }
  if (input.corner_count < 0 || !Number.isInteger(input.corner_count)) {
    throw new PricingError("INVALID_CORNERS", "corner_count must be a non-negative integer");
  }
  if (!(input.slope_code in SLOPE)) {
    throw new PricingError("INVALID_SLOPE", `slope_code ${input.slope_code} not recognized`);
  }
  if (!(input.demo_type in DEMO_RATES)) {
    throw new PricingError("INVALID_DEMO", `demo_type ${input.demo_type} not recognized`);
  }

  if (input.linear_feet < LF_LIMITS.MIN) {
    warnings.push(`SHORT_RUN: ${input.linear_feet} LF below minimum ${LF_LIMITS.MIN} — recommend in-home estimate`);
  }
  if (input.linear_feet > LF_LIMITS.MAX) {
    warnings.push(`LONG_RUN: ${input.linear_feet} LF above max ${LF_LIMITS.MAX} — recommend in-home estimate`);
  }
  if (input.height_upgrade && !HEIGHT_UPGRADE_FAMILIES.has(sku.family)) {
    warnings.push(`HEIGHT_UPGRADE_IGNORED: not available for family ${sku.family}`);
  }

  // ─── Buildup (cents, kept in floats for now, rounded at the end) ──
  const slopeMul = SLOPE[input.slope_code].multiplier;
  const demoRate = DEMO_RATES[input.demo_type];

  const baseFenceRaw = input.linear_feet * sku.base_price_per_lf_cents * slopeMul;
  const heightUpgradeRaw =
    input.height_upgrade && HEIGHT_UPGRADE_FAMILIES.has(sku.family)
      ? baseFenceRaw * ADDONS.HEIGHT_UPGRADE_PCT
      : 0;
  const frenchGothicRaw = input.french_gothic
    ? input.linear_feet * ADDONS.FRENCH_GOTHIC_PER_LF_CENTS
    : 0;
  const stainRaw = input.stain_seal ? input.linear_feet * ADDONS.STAIN_PER_LF_CENTS : 0;
  const demoRaw = input.linear_feet * demoRate;
  const cornersRaw =
    Math.max(0, input.corner_count - ADDONS.CORNER_FREE) * ADDONS.CORNER_OVER_CENTS;

  let gatesRaw = 0;
  for (const g of input.gates) {
    if (!(g.type in GATE_PRICES)) {
      throw new PricingError("INVALID_GATE", `gate type ${g.type} not recognized`);
    }
    if (!Number.isInteger(g.count) || g.count < 0) {
      throw new PricingError("INVALID_GATE_COUNT", "gate count must be a non-negative integer");
    }
    gatesRaw += g.count * GATE_PRICES[g.type].price_cents;
  }

  const permitRaw = input.permit_required ? ADDONS.PERMIT_FLAT_CENTS : 0;
  const hoaAdminRaw = input.hoa_admin ? ADDONS.HOA_ADMIN_FLAT_CENTS : 0;
  const travelRaw = (input.travel_miles_over_25 ?? 0) * ADDONS.TRAVEL_PER_MILE_CENTS;

  // Round each breakdown line for display, then re-sum for tier basis
  const breakdown = {
    base_fence: Math.round(baseFenceRaw),
    height_upgrade: Math.round(heightUpgradeRaw),
    french_gothic: Math.round(frenchGothicRaw),
    stain: Math.round(stainRaw),
    demo: Math.round(demoRaw),
    corners: Math.round(cornersRaw),
    gates: Math.round(gatesRaw),
    permit: Math.round(permitRaw),
    hoa_admin: Math.round(hoaAdminRaw),
    travel: Math.round(travelRaw),
  };

  const baseTotal = Object.values(breakdown).reduce((a, b) => a + b, 0); // = good tier

  // ─── Tier prices ──────────────────────────────────────────────────
  const goodTotal = Math.round(baseTotal * TIER_MULTIPLIERS.good);
  const betterTotal = Math.round(baseTotal * TIER_MULTIPLIERS.better);
  const bestTotal = Math.round(baseTotal * TIER_MULTIPLIERS.best);

  // ─── Monthly payment per tier (PMT formula) ──────────────────────
  const monthlyGood = pmtCents(goodTotal, FINANCING.APR, FINANCING.MONTHS);
  const monthlyBetter = pmtCents(betterTotal, FINANCING.APR, FINANCING.MONTHS);
  const monthlyBest = pmtCents(bestTotal, FINANCING.APR, FINANCING.MONTHS);

  // ─── Internal margin (better-tier basis) ──────────────────────────
  // subtotal == better tier total — that's the anchor and the most-likely sale.
  const subtotalForMargin = betterTotal;
  const materialCost = Math.round(input.linear_feet * sku.material_cost_per_lf_cents);
  const gateMaterialCost = Math.round(breakdown.gates * ADDONS.GATE_MATERIAL_PCT);
  const subLaborCost = Math.round(subtotalForMargin * sku.sub_labor_pct);
  const overheadCost = Math.round(subtotalForMargin * ADDONS.OVERHEAD_PCT);
  const totalCost = materialCost + gateMaterialCost + subLaborCost + overheadCost + breakdown.permit;
  const grossProfit = subtotalForMargin - totalCost;
  const grossMarginPct = subtotalForMargin > 0 ? grossProfit / subtotalForMargin : 0;

  let marginFlag: MarginFlag = "ok";
  if (grossMarginPct < MARGIN_THRESHOLDS.LOW) marginFlag = "low";
  else if (grossMarginPct < MARGIN_THRESHOLDS.WARN) marginFlag = "warn";

  const internal_margin: InternalMargin = {
    material_cost_cents: materialCost,
    gate_material_cost_cents: gateMaterialCost,
    sub_labor_cost_cents: subLaborCost,
    overhead_cost_cents: overheadCost,
    total_cost_cents: totalCost,
    gross_profit_cents: grossProfit,
    gross_margin_pct: round4(grossMarginPct),
    margin_flag: marginFlag,
  };

  return {
    subtotal_cents: betterTotal, // default tier
    tiers: {
      good:   { total_cents: goodTotal,   monthly_24mo_cents: monthlyGood },
      better: { total_cents: betterTotal, monthly_24mo_cents: monthlyBetter },
      best:   { total_cents: bestTotal,   monthly_24mo_cents: monthlyBest },
    },
    deposit_cents: FINANCING.DEPOSIT_CENTS,
    valid_until: new Date(Date.now() + FINANCING.QUOTE_VALID_DAYS * 86400_000).toISOString(),
    breakdown,
    internal_margin,
    warnings,
  };
}

/**
 * Strip internal-margin block for client-facing responses.
 * Customer-facing endpoints MUST run output through this.
 */
export function stripInternal(result: PricingResult): Omit<PricingResult, "internal_margin"> {
  const safe = { ...result } as Partial<PricingResult>;
  delete safe.internal_margin;
  return safe as Omit<PricingResult, "internal_margin">;
}

/**
 * Standard amortization formula: M = P·r / (1 − (1+r)^−n)
 * @param principalCents loan amount in cents
 * @param apr annual percentage rate as decimal (e.g. 0.0999 for 9.99%)
 * @param months term length in months
 * @returns monthly payment in cents (rounded)
 */
export function pmtCents(principalCents: number, apr: number, months: number): number {
  if (principalCents <= 0 || months <= 0) return 0;
  if (apr === 0) return Math.round(principalCents / months);
  const r = apr / 12;
  const monthly = (principalCents * r) / (1 - Math.pow(1 + r, -months));
  return Math.round(monthly);
}

/** Round to 4 decimal places (for percentages stored as decimals) */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Pick the right SKU based on family + tier — handy for UI pickers */
export function getSkuCode(family: string, tier: Tier): string {
  const tierSuffix = tier === "good" ? "G" : tier === "better" ? "B" : "X";
  return `${family}-${tierSuffix}`;
}
