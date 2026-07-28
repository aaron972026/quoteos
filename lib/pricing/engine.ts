import { DEFAULT_PRICING_CONFIG, type PricingConfig } from "./data";
import {
  type InternalMargin,
  type MarginFlag,
  type PostType,
  PricingError,
  type PricingInput,
  type PricingResult,
} from "./types";

/**
 * Pricing engine — cost-up to target margin with floor/profit guards.
 *
 * Pure function: same input → same output, no side effects, no I/O.
 *
 * Math (matches _pricing/FencePros_Pricing_Model.csv-job-estimator):
 *   1. fence/LF = SKU.base_price (pre-derived at 45% target margin)
 *   2. fence/LF × slope_mul × access_mul × LF = fence_subtotal
 *   3. + post upgrade (cedar +$3/LF or steel +$6/LF, wood-picket families)
 *   4. + gates (sum of count × price by type)
 *   5. + demo ($3/LF when demo_type != NONE)
 *   6. + stain ($8/LF if toggled)
 *   7. + rock drilling ($25/post)
 *   8. + tear concrete ($20/post)
 *   9. + permit (city-specific, baked in)
 *   = raw_subtotal
 *
 *   Guards (raise price, never lower):
 *     - margin floor: price ≥ cost / (1 - 0.38)
 *     - min profit:   price ≥ cost + $800
 *
 *   Round final price to nearest $50.
 *   Display range = [final - swing, final]
 *     where swing = clamp(5% × final, $200, $1200)
 */
export function calculatePrice(
  input: PricingInput,
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): PricingResult {
  const sku = config.skuByCode[input.sku_code];
  if (!sku) {
    throw new PricingError("UNKNOWN_SKU", `SKU not found: ${input.sku_code}`);
  }

  // ─── Validation ───────────────────────────────────────────────────
  if (!Number.isFinite(input.linear_feet) || input.linear_feet <= 0) {
    throw new PricingError("INVALID_LF", "linear_feet must be > 0");
  }
  if (!(input.slope_code in config.slope)) {
    throw new PricingError(
      "INVALID_SLOPE",
      `slope_code ${input.slope_code} not recognized`
    );
  }
  if (!(input.demo_type in config.demoRates)) {
    throw new PricingError(
      "INVALID_DEMO",
      `demo_type ${input.demo_type} not recognized`
    );
  }

  const warnings: string[] = [];
  const { assumptions, costRatios, addons } = config;

  // ─── Surcharge multipliers (slope + difficult access) ──────────────
  const slopeEntry = config.slope[input.slope_code];
  const slopeMul = 1 + slopeEntry.surcharge_pct;
  if (slopeEntry.review_required) warnings.push("slope_review_required");

  const accessMul = input.difficult_access ? 1 + addons.ACCESS_SURCHARGE_PCT : 1;

  // ─── Fence subtotal (post-slope, post-access) ──────────────────────
  // Compute deltas so the breakdown can surface slope + access contributions
  // separately while keeping them inside `base_fence_cents`.
  const baseFenceFlat = sku.base_price_per_lf_cents * input.linear_feet;
  const fenceWithSlope = baseFenceFlat * slopeMul;
  const fenceWithBoth = fenceWithSlope * accessMul;

  const baseFenceCents = Math.round(fenceWithBoth);
  const slopeSurchargeCents = Math.round(fenceWithSlope - baseFenceFlat);
  const accessSurchargeCents = Math.round(fenceWithBoth - fenceWithSlope);

  // ─── Post material upgrade (wood-post families only) ───────────────
  // post_type supersedes the legacy steel_post_upgrade flag: 'pt' is the
  // included default, 'cedar' is +$3/LF, 'steel' (PostMaster) is +$6/LF.
  // Back-compat: callers still sending steel_post_upgrade map true → 'steel'.
  const postType: PostType =
    input.post_type ?? (input.steel_post_upgrade ? "steel" : "pt");
  const postFamilyOk = config.steelUpgradeFamilies.has(sku.family);

  let steelUpgradeCents = 0;
  let cedarPostCents = 0;
  if (postType === "steel") {
    if (postFamilyOk) {
      steelUpgradeCents = input.linear_feet * addons.STEEL_UPGRADE_PER_LF_CENTS;
    } else {
      warnings.push("steel_upgrade_ignored");
    }
  } else if (postType === "cedar") {
    if (postFamilyOk) {
      cedarPostCents = input.linear_feet * addons.CEDAR_POST_PER_LF_CENTS;
    } else {
      warnings.push("cedar_post_ignored");
    }
  }

  // ─── Ironclad Install bundle ($13/LF, wood-post families only) ─────
  // Bundles steel posts + stain & seal + the 36"-deep / 240+ lb post set
  // + extended warranties (3-yr workmanship, 10-yr structure). The
  // bundle ABSORBS the standalone steel and stain charges: if those
  // flags also arrive (e.g. stain_seal is persisted true so the BOM
  // orders stain materials), their line items zero out with a warning
  // rather than double-charging.
  // Ivory Standard forces steel posts as part of the bundle, so any post
  // adder (steel OR cedar) is absorbed here — steel is charged exactly once,
  // via the bundle, never stacked on top.
  let ironcladCents = 0;
  if (input.ironclad) {
    if (config.steelUpgradeFamilies.has(sku.family)) {
      ironcladCents = input.linear_feet * addons.IRONCLAD_PER_LF_CENTS;
      if (steelUpgradeCents > 0) {
        steelUpgradeCents = 0;
        warnings.push("steel_absorbed_by_ironclad");
      }
      if (cedarPostCents > 0) {
        cedarPostCents = 0;
        warnings.push("cedar_absorbed_by_ironclad");
      }
    } else {
      warnings.push("ironclad_ignored");
    }
  }
  const ironcladActive = ironcladCents > 0;

  // ─── Cap rail + trim ($4/LF, wood-picket families only) ────────────
  let capRailCents = 0;
  if (input.cap_rail_trim) {
    if (config.capRailFamilies.has(sku.family)) {
      capRailCents = input.linear_feet * addons.CAP_RAIL_PER_LF_CENTS;
    } else {
      warnings.push("cap_rail_ignored");
    }
  }

  // ─── Board-on-board privacy ($7/LF, wood-picket families only) ─────
  // Overlapped pickets so the fence stays gap-free as the wood dries.
  let boardOnBoardCents = 0;
  if (input.board_on_board) {
    if (config.capRailFamilies.has(sku.family)) {
      boardOnBoardCents =
        input.linear_feet * addons.BOARD_ON_BOARD_PER_LF_CENTS;
    } else {
      warnings.push("board_on_board_ignored");
    }
  }

  // ─── Match black vinyl posts ($3/LF, CL-VIN only) ──────────────────
  let matchVinylPostsCents = 0;
  if (input.match_vinyl_posts) {
    if (sku.code === "CL-VIN") {
      matchVinylPostsCents =
        input.linear_feet * addons.MATCH_VINYL_POSTS_PER_LF_CENTS;
    } else {
      warnings.push("match_vinyl_posts_ignored");
    }
  }

  // ─── Gates ─────────────────────────────────────────────────────────
  let gatesCents = 0;
  for (const g of input.gates) {
    if (!(g.type in config.gatePrices)) {
      throw new PricingError(
        "INVALID_GATE",
        `gate type ${g.type} not recognized`
      );
    }
    if (!Number.isInteger(g.count) || g.count < 0) {
      throw new PricingError(
        "INVALID_GATE_COUNT",
        "gate count must be a non-negative integer"
      );
    }
    gatesCents += g.count * config.gatePrices[g.type].price_cents;
  }

  // ─── Demo (per LF) ─────────────────────────────────────────────────
  const demoRate = config.demoRates[input.demo_type];
  const demoLf =
    input.demo_type === "NONE"
      ? 0
      : input.demo_lf != null
        ? input.demo_lf
        : input.linear_feet;
  const demoCents = Math.round(demoLf * demoRate);

  // ─── Stain & seal ($8/LF) ──────────────────────────────────────────
  // Included in Ironclad — the standalone $8/LF charge zeroes out when
  // the bundle is active (stain_seal may still arrive true so the BOM
  // orders stain materials).
  let stainCents = 0;
  if (input.stain_seal) {
    if (ironcladActive) {
      warnings.push("stain_absorbed_by_ironclad");
    } else {
      stainCents = input.linear_feet * addons.STAIN_PER_LF_CENTS;
    }
  }

  // ─── Rock drilling + tear concrete ─────────────────────────────────
  const rockPosts = input.rock_drilling_posts ?? 0;
  const tearPosts = input.tear_concrete_posts ?? 0;
  if (rockPosts < 0 || !Number.isInteger(rockPosts)) {
    throw new PricingError(
      "INVALID_ROCK_POSTS",
      "rock_drilling_posts must be a non-negative integer"
    );
  }
  if (tearPosts < 0 || !Number.isInteger(tearPosts)) {
    throw new PricingError(
      "INVALID_TEAR_POSTS",
      "tear_concrete_posts must be a non-negative integer"
    );
  }
  const rockDrillingCents = rockPosts * addons.ROCK_PER_POST_CENTS;
  const tearConcreteCents = tearPosts * addons.TEAR_CONCRETE_PER_POST_CENTS;

  // ─── Permit (city-keyed) ───────────────────────────────────────────
  const city = input.city ?? "Tulsa";
  const permitCents = config.permits[city] ?? config.permitDefaultCents;

  // ─── Raw subtotal (pre-guards) ─────────────────────────────────────
  const rawSubtotal =
    baseFenceCents +
    ironcladCents +
    steelUpgradeCents +
    cedarPostCents +
    capRailCents +
    boardOnBoardCents +
    matchVinylPostsCents +
    gatesCents +
    demoCents +
    stainCents +
    rockDrillingCents +
    tearConcreteCents +
    permitCents;

  // ─── Internal cost estimate ────────────────────────────────────────
  // Fence cost = (material + waste + labor + overhead) × LF — this is the
  // SKU's own total_cost/LF, derived in data.ts. We re-derive here to keep
  // engine self-contained.
  const wasteAdjMaterial =
    sku.material_cost_per_lf_cents * (1 + assumptions.material_waste_pct);
  const fencePerLfCost =
    wasteAdjMaterial +
    sku.labor_cost_per_lf_cents +
    assumptions.overhead_per_lf_cents;
  const fenceCostCents = Math.round(fencePerLfCost * input.linear_feet);

  // Material vs labor split for the internal_margin breakdown
  const materialCostCents = Math.round(wasteAdjMaterial * input.linear_feet);
  const laborCostCents = Math.round(
    sku.labor_cost_per_lf_cents * input.linear_feet
  );
  const overheadCostCents = Math.round(
    assumptions.overhead_per_lf_cents * input.linear_feet
  );

  // Add-on costs use industry-derived ratios (see data.ts:COST_RATIOS)
  const gateCost = Math.round(gatesCents * costRatios.GATE);
  const demoCost = Math.round(demoCents * costRatios.DEMO);
  const stainCost = Math.round(stainCents * costRatios.STAIN);
  const steelCost = Math.round(steelUpgradeCents * costRatios.STEEL_UPGRADE);
  const cedarPostCost = Math.round(cedarPostCents * costRatios.CEDAR_POST);
  const ironcladCost = Math.round(ironcladCents * costRatios.IRONCLAD);
  const capRailCost = Math.round(capRailCents * costRatios.CAP_RAIL);
  const boardOnBoardCost = Math.round(
    boardOnBoardCents * costRatios.BOARD_ON_BOARD
  );
  const matchVinylCost = Math.round(
    matchVinylPostsCents * costRatios.MATCH_VINYL_POSTS
  );
  const rockCost = Math.round(rockDrillingCents * costRatios.ROCK_DRILLING);
  const tearCost = Math.round(tearConcreteCents * costRatios.TEAR_CONCRETE);
  const permitCost = Math.round(permitCents * costRatios.PERMIT);

  const totalCostCents =
    fenceCostCents +
    ironcladCost +
    gateCost +
    demoCost +
    stainCost +
    steelCost +
    cedarPostCost +
    capRailCost +
    boardOnBoardCost +
    matchVinylCost +
    rockCost +
    tearCost +
    permitCost;

  // ─── Margin guards (raise price only, never lower) ─────────────────
  let postGuardPrice = rawSubtotal;
  const guards: string[] = [];

  // Margin floor: price ≥ cost / (1 - margin_floor_pct)
  const floorMin = Math.round(
    totalCostCents / (1 - assumptions.margin_floor_pct)
  );
  if (postGuardPrice < floorMin) {
    postGuardPrice = floorMin;
    guards.push("margin_floor");
  }

  // Min profit: price ≥ cost + min_job_profit
  const profitMin = totalCostCents + assumptions.min_job_profit_cents;
  if (postGuardPrice < profitMin) {
    postGuardPrice = profitMin;
    if (!guards.includes("min_profit")) guards.push("min_profit");
  }

  // ─── Round to nearest $50 ──────────────────────────────────────────
  const finalPriceCents =
    Math.round(postGuardPrice / assumptions.round_to_cents) *
    assumptions.round_to_cents;

  // ─── Display range (swing scales with job size) ────────────────────
  const swingRaw = Math.round(
    finalPriceCents * assumptions.range_swing_pct
  );
  const swingCents = Math.max(
    assumptions.range_swing_min_cents,
    Math.min(assumptions.range_swing_max_cents, swingRaw)
  );
  const displayLowCents = Math.max(0, finalPriceCents - swingCents);

  // ─── Final margin (post-round) ─────────────────────────────────────
  const grossProfitCents = finalPriceCents - totalCostCents;
  const grossMarginPct =
    finalPriceCents > 0 ? grossProfitCents / finalPriceCents : 0;

  let marginFlag: MarginFlag = "ok";
  if (grossMarginPct < config.marginThresholds.LOW) marginFlag = "low";
  else if (grossMarginPct < config.marginThresholds.WARN) marginFlag = "warn";

  // ─── Sanity warnings ───────────────────────────────────────────────
  if (sku.market_flag === "ABOVE_MKT") warnings.push("above_market");
  if (input.linear_feet < assumptions.lf_min) warnings.push("short_run");
  if (input.linear_feet > assumptions.lf_max) warnings.push("long_run");

  const internal_margin: InternalMargin = {
    material_cost_cents: materialCostCents,
    labor_cost_cents: laborCostCents,
    overhead_cost_cents: overheadCostCents,
    total_cost_cents: totalCostCents,
    gross_profit_cents: grossProfitCents,
    gross_margin_pct: round4(grossMarginPct),
    margin_flag: marginFlag,
  };

  const monthly24moCents = pmtCents(
    finalPriceCents,
    config.financing.APR,
    config.financing.MONTHS
  );

  return {
    final_price_cents: finalPriceCents,
    display_range_low_cents: displayLowCents,
    display_range_high_cents: finalPriceCents,
    deposit_cents: config.financing.DEPOSIT_CENTS,
    monthly_24mo_cents: monthly24moCents,
    valid_until: new Date(
      Date.now() + config.financing.QUOTE_VALID_DAYS * 86400_000
    ).toISOString(),
    breakdown: {
      base_fence_cents: baseFenceCents,
      slope_surcharge_cents: slopeSurchargeCents,
      access_surcharge_cents: accessSurchargeCents,
      steel_upgrade_cents: steelUpgradeCents,
      cedar_post_cents: cedarPostCents,
      ironclad_cents: ironcladCents,
      board_on_board_cents: boardOnBoardCents,
      cap_rail_cents: capRailCents,
      match_vinyl_posts_cents: matchVinylPostsCents,
      gates_cents: gatesCents,
      demo_cents: demoCents,
      stain_cents: stainCents,
      rock_drilling_cents: rockDrillingCents,
      tear_concrete_cents: tearConcreteCents,
      permit_cents: permitCents,
    },
    raw_subtotal_cents: rawSubtotal,
    guards_applied: guards,
    internal_margin,
    warnings,
    effective_per_lf_cents:
      input.linear_feet > 0
        ? Math.round(finalPriceCents / input.linear_feet)
        : 0,
  };
}

/**
 * Strip internal-margin from a result for public/customer-facing responses.
 * Server boundary helper — call this before returning to non-admin clients.
 */
export function stripInternal(
  result: PricingResult
): Omit<PricingResult, "internal_margin"> {
  const safe = { ...result } as Partial<PricingResult>;
  delete safe.internal_margin;
  return safe as Omit<PricingResult, "internal_margin">;
}

/** Standard amortization: M = P·r / (1 − (1+r)^−n) */
export function pmtCents(
  principalCents: number,
  apr: number,
  months: number
): number {
  if (principalCents <= 0 || months <= 0) return 0;
  if (apr === 0) return Math.round(principalCents / months);
  const r = apr / 12;
  const monthly = (principalCents * r) / (1 - Math.pow(1 + r, -months));
  return Math.round(monthly);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
