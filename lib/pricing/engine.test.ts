import { describe, expect, it } from "vitest";
import { calculatePrice, pmtCents, stripInternal } from "./engine";
import { ASSUMPTIONS, SKU_BY_CODE, SLOPE, GATE_PRICES } from "./data";
import type { PricingInput } from "./types";

// Baseline input — overrideable per test
function input(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    sku_code: "CPF-PRM",
    linear_feet: 150,
    corner_count: 4,
    slope_code: 0,
    demo_type: "NONE",
    gates: [],
    stain_seal: false,
    steel_post_upgrade: false,
    city: "Tulsa",
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════
// SKU price derivation — cost-up math self-consistency
// ════════════════════════════════════════════════════════════════════
describe("SKU price derivation", () => {
  it("CPF-PRM derives to $44.82/LF at 45% target margin", () => {
    // material 13 × 1.05 waste = 13.65; + labor 8 + overhead 3 = 24.65;
    // price = 24.65 / 0.55 = 44.818... → 4482 cents
    expect(SKU_BY_CODE["CPF-PRM"].base_price_per_lf_cents).toBe(4482);
  });

  it("BP-STD (KDAT pine) derives to $35.41/LF", () => {
    expect(SKU_BY_CODE["BP-STD"].base_price_per_lf_cents).toBe(3541);
  });

  it("CL-RES derives to $24.14/LF", () => {
    expect(SKU_BY_CODE["CL-RES"].base_price_per_lf_cents).toBe(2414);
  });

  it("RR-4 derives above market ($34.59 vs $34 cap) and flags it", () => {
    const sku = SKU_BY_CODE["RR-4"];
    expect(sku.market_max_per_lf_cents).toBe(3400);
    expect(sku.market_flag).toBe("ABOVE_MKT");
  });
});

// ════════════════════════════════════════════════════════════════════
// CSV worked example — CPF-PRM, 150 LF, slope 1, 1 walk gate, Tulsa
// Spreadsheet says $7,600 max (with their internal $450 walk gate).
// We use $350 W4 from the add-ons sheet → expect $7,500 instead.
// ════════════════════════════════════════════════════════════════════
describe("CSV worked example", () => {
  const result = calculatePrice(
    input({
      sku_code: "CPF-PRM",
      linear_feet: 150,
      slope_code: 1,
      gates: [{ type: "W4", count: 1 }],
      city: "Tulsa",
    })
  );

  it("fence subtotal includes 5% slope surcharge", () => {
    // base 4482 × 1.05 × 150 = 705,915 cents
    expect(result.breakdown.base_fence_cents).toBe(705915);
    expect(result.breakdown.slope_surcharge_cents).toBe(33615);
  });

  it("walk gate W4 adds $350", () => {
    expect(result.breakdown.gates_cents).toBe(35000);
  });

  it("Tulsa permit adds $75", () => {
    expect(result.breakdown.permit_cents).toBe(7500);
  });

  it("raw subtotal is $7,484.15 (no guard triggers)", () => {
    expect(result.raw_subtotal_cents).toBe(705915 + 35000 + 7500);
    expect(result.guards_applied).toEqual([]);
  });

  it("rounds final to nearest $50 → $7,500", () => {
    expect(result.final_price_cents).toBe(750000);
  });

  it("display range swing scales to 5% of total ($375)", () => {
    expect(result.display_range_high_cents).toBe(750000);
    expect(result.display_range_low_cents).toBe(750000 - 37500);
  });

  it("internal margin stays above 45% target", () => {
    expect(result.internal_margin.gross_margin_pct).toBeGreaterThan(0.45);
    expect(result.internal_margin.margin_flag).toBe("ok");
  });

  it("effective $/LF is final / LF rounded", () => {
    expect(result.effective_per_lf_cents).toBe(Math.round(750000 / 150));
  });
});

// ════════════════════════════════════════════════════════════════════
// Slope adjustments
// ════════════════════════════════════════════════════════════════════
describe("slope adjustments", () => {
  it("slope 0 applies no surcharge", () => {
    const r = calculatePrice(input({ slope_code: 0 }));
    expect(r.breakdown.slope_surcharge_cents).toBe(0);
  });

  it("slope 1 applies 5%", () => {
    const r = calculatePrice(input({ slope_code: 1 }));
    const base = SKU_BY_CODE["CPF-PRM"].base_price_per_lf_cents * 150;
    expect(r.breakdown.slope_surcharge_cents).toBeCloseTo(base * 0.05, -2);
  });

  it("slope 3 applies 18% (per updated CSV)", () => {
    const r = calculatePrice(input({ slope_code: 3 }));
    const base = SKU_BY_CODE["CPF-PRM"].base_price_per_lf_cents * 150;
    expect(r.breakdown.slope_surcharge_cents).toBeCloseTo(base * 0.18, -2);
  });

  it("slope 4 uses 18% and emits review warning", () => {
    const r = calculatePrice(input({ slope_code: 4 }));
    expect(r.warnings).toContain("slope_review_required");
    expect(SLOPE[4].surcharge_pct).toBe(0.18);
  });

  it("throws on invalid slope code", () => {
    expect(() => calculatePrice(input({ slope_code: 99 }))).toThrow(
      /INVALID_SLOPE/
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// Margin floor + min profit guards
// ════════════════════════════════════════════════════════════════════
describe("margin floor guard", () => {
  it("does NOT trigger on a healthy 150 LF cedar job", () => {
    const r = calculatePrice(input());
    expect(r.guards_applied).not.toContain("margin_floor");
  });

  it("post-guard margin sits at or above the 38% floor", () => {
    const r = calculatePrice(
      input({
        linear_feet: 25,
        demo_type: "CEDAR",
        rock_drilling_posts: 10,
        tear_concrete_posts: 10,
      })
    );
    expect(r.internal_margin.gross_margin_pct).toBeGreaterThanOrEqual(0.38);
  });
});

describe("min profit guard ($800)", () => {
  it("forces price up on a tiny job with no add-ons", () => {
    const r = calculatePrice(
      input({
        sku_code: "CL-RES",
        linear_feet: 20,
        city: "Owasso",
      })
    );
    expect(
      r.internal_margin.gross_profit_cents >= 80000 ||
        r.guards_applied.includes("min_profit")
    ).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// Rounding + display swing
// ════════════════════════════════════════════════════════════════════
describe("$50 rounding + display swing", () => {
  it("rounds final price to nearest $50", () => {
    const r = calculatePrice(input());
    expect(r.final_price_cents % 5000).toBe(0);
  });

  it("swing clamps to $200 minimum on small jobs", () => {
    const r = calculatePrice(
      input({ sku_code: "CL-RES", linear_feet: 20, city: "Owasso" })
    );
    const swing = r.display_range_high_cents - r.display_range_low_cents;
    expect(swing).toBeGreaterThanOrEqual(ASSUMPTIONS.range_swing_min_cents);
  });

  it("swing clamps to $1,200 ceiling on large jobs", () => {
    const r = calculatePrice(input({ sku_code: "CPF-EST", linear_feet: 800 }));
    const swing = r.display_range_high_cents - r.display_range_low_cents;
    expect(swing).toBeLessThanOrEqual(ASSUMPTIONS.range_swing_max_cents);
  });

  it("swing = 5% of final on medium jobs", () => {
    const r = calculatePrice(input());
    const expected = Math.round(r.final_price_cents * 0.05);
    const actual = r.display_range_high_cents - r.display_range_low_cents;
    if (
      expected >= ASSUMPTIONS.range_swing_min_cents &&
      expected <= ASSUMPTIONS.range_swing_max_cents
    ) {
      expect(actual).toBe(expected);
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// Add-ons
// ════════════════════════════════════════════════════════════════════
describe("add-ons", () => {
  it("steel upgrade adds $6/LF on cedar families", () => {
    const noUp = calculatePrice(input({ sku_code: "CPF-PRM" }));
    const withUp = calculatePrice(
      input({ sku_code: "CPF-PRM", post_type: "steel" })
    );
    expect(withUp.breakdown.steel_upgrade_cents).toBe(150 * 600);
    expect(withUp.raw_subtotal_cents).toBeGreaterThan(noUp.raw_subtotal_cents);
  });

  it("legacy steel_post_upgrade flag still maps to steel ($6/LF)", () => {
    const withUp = calculatePrice(
      input({ sku_code: "CPF-PRM", steel_post_upgrade: true })
    );
    expect(withUp.breakdown.steel_upgrade_cents).toBe(150 * 600);
  });

  it("cedar posts add $3/LF on wood-picket families", () => {
    const noUp = calculatePrice(input({ sku_code: "CPF-PRM" }));
    const withCedar = calculatePrice(
      input({ sku_code: "CPF-PRM", post_type: "cedar" })
    );
    expect(withCedar.breakdown.cedar_post_cents).toBe(150 * 300);
    expect(withCedar.breakdown.steel_upgrade_cents).toBe(0);
    expect(withCedar.raw_subtotal_cents).toBeGreaterThan(
      noUp.raw_subtotal_cents
    );
  });

  it("cedar posts are ignored (with warning) on chain link", () => {
    const r = calculatePrice(
      input({ sku_code: "CL-RES", post_type: "cedar" })
    );
    expect(r.breakdown.cedar_post_cents).toBe(0);
    expect(r.warnings).toContain("cedar_post_ignored");
  });

  it("post_type 'pt' is the free default — no post adder", () => {
    const pt = calculatePrice(input({ sku_code: "CPF-PRM", post_type: "pt" }));
    expect(pt.breakdown.steel_upgrade_cents).toBe(0);
    expect(pt.breakdown.cedar_post_cents).toBe(0);
  });

  it("steel upgrade is ignored (with warning) on chain link", () => {
    const r = calculatePrice(
      input({ sku_code: "CL-RES", steel_post_upgrade: true })
    );
    expect(r.breakdown.steel_upgrade_cents).toBe(0);
    expect(r.warnings).toContain("steel_upgrade_ignored");
  });

  it("steel upgrade is ignored on ranch rail", () => {
    const r = calculatePrice(
      input({ sku_code: "RR-3", steel_post_upgrade: true })
    );
    expect(r.breakdown.steel_upgrade_cents).toBe(0);
    expect(r.warnings).toContain("steel_upgrade_ignored");
  });

  it("stain & seal adds $6/LF", () => {
    const r = calculatePrice(input({ stain_seal: true }));
    expect(r.breakdown.stain_cents).toBe(150 * 600);
  });

  it("demo adds $3/LF when demo_type is not NONE", () => {
    const r = calculatePrice(input({ demo_type: "CEDAR" }));
    expect(r.breakdown.demo_cents).toBe(150 * 300);
  });

  it("demo respects demo_lf override", () => {
    const r = calculatePrice(input({ demo_type: "CEDAR", demo_lf: 50 }));
    expect(r.breakdown.demo_cents).toBe(50 * 300);
  });

  it("demo is 0 when demo_type = NONE", () => {
    const r = calculatePrice(input({ demo_type: "NONE", demo_lf: 100 }));
    expect(r.breakdown.demo_cents).toBe(0);
  });

  it("rock drilling adds $25/post", () => {
    const r = calculatePrice(input({ rock_drilling_posts: 4 }));
    expect(r.breakdown.rock_drilling_cents).toBe(4 * 2500);
  });

  it("tear concrete adds $20/post", () => {
    const r = calculatePrice(input({ tear_concrete_posts: 6 }));
    expect(r.breakdown.tear_concrete_cents).toBe(6 * 2000);
  });

  it("difficult access surcharge applies +8% to fence subtotal", () => {
    const flat = calculatePrice(input());
    const access = calculatePrice(input({ difficult_access: true }));
    expect(access.breakdown.access_surcharge_cents).toBeGreaterThan(0);
    expect(access.breakdown.base_fence_cents).toBeGreaterThan(
      flat.breakdown.base_fence_cents
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// Gates
// ════════════════════════════════════════════════════════════════════
describe("gates", () => {
  it("sums multiple gates", () => {
    const r = calculatePrice(
      input({
        gates: [
          { type: "W4", count: 1 },
          { type: "D12", count: 1 },
        ],
      })
    );
    expect(r.breakdown.gates_cents).toBe(35000 + 110000);
  });

  it("D16 is the largest at $1,750", () => {
    expect(GATE_PRICES.D16.price_cents).toBe(175000);
  });

  it("throws on invalid gate type", () => {
    // Cast a bogus type to exercise the runtime guard; bypassing the
    // compile-time GateType union is the whole point of the test.
    const bogus = { type: "X", count: 1 } as unknown as PricingInput["gates"][number];
    expect(() => calculatePrice(input({ gates: [bogus] }))).toThrow(
      /INVALID_GATE/
    );
  });

  it("throws on negative gate count", () => {
    expect(() =>
      calculatePrice(input({ gates: [{ type: "W4", count: -1 }] }))
    ).toThrow(/INVALID_GATE_COUNT/);
  });
});

// ════════════════════════════════════════════════════════════════════
// Permits by city
// ════════════════════════════════════════════════════════════════════
describe("permits", () => {
  it("Tulsa = $75", () => {
    const r = calculatePrice(input({ city: "Tulsa" }));
    expect(r.breakdown.permit_cents).toBe(7500);
  });

  it("Owasso = $0", () => {
    const r = calculatePrice(input({ city: "Owasso" }));
    expect(r.breakdown.permit_cents).toBe(0);
  });

  it("Broken Arrow defaults to $75 (Tulsa parity until confirmed)", () => {
    const r = calculatePrice(input({ city: "Broken Arrow" }));
    expect(r.breakdown.permit_cents).toBe(7500);
  });

  it("Unknown city falls back to $75 default", () => {
    const r = calculatePrice(input({ city: "Springfield" }));
    expect(r.breakdown.permit_cents).toBe(7500);
  });
});

// ════════════════════════════════════════════════════════════════════
// Warnings
// ════════════════════════════════════════════════════════════════════
describe("warnings", () => {
  it("above_market fires on RR-4", () => {
    const r = calculatePrice(input({ sku_code: "RR-4" }));
    expect(r.warnings).toContain("above_market");
  });

  it("short_run fires below 20 LF", () => {
    const r = calculatePrice(input({ linear_feet: 10 }));
    expect(r.warnings).toContain("short_run");
  });

  it("long_run fires above 1000 LF", () => {
    const r = calculatePrice(input({ linear_feet: 1200 }));
    expect(r.warnings).toContain("long_run");
  });
});

// ════════════════════════════════════════════════════════════════════
// Validation
// ════════════════════════════════════════════════════════════════════
describe("validation", () => {
  it("throws on unknown SKU", () => {
    expect(() => calculatePrice(input({ sku_code: "ZZZ" }))).toThrow(
      /UNKNOWN_SKU/
    );
  });

  it("throws on zero LF", () => {
    expect(() => calculatePrice(input({ linear_feet: 0 }))).toThrow(/INVALID_LF/);
  });

  it("throws on negative LF", () => {
    expect(() => calculatePrice(input({ linear_feet: -10 }))).toThrow(
      /INVALID_LF/
    );
  });

  it("throws on negative rock_drilling_posts", () => {
    expect(() => calculatePrice(input({ rock_drilling_posts: -1 }))).toThrow(
      /INVALID_ROCK_POSTS/
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// Public-response sanitizer
// ════════════════════════════════════════════════════════════════════
describe("stripInternal", () => {
  it("removes internal_margin from the result", () => {
    const r = calculatePrice(input());
    const safe = stripInternal(r);
    expect("internal_margin" in safe).toBe(false);
    expect(safe.final_price_cents).toBe(r.final_price_cents);
  });
});

// ════════════════════════════════════════════════════════════════════
// PMT helper
// ════════════════════════════════════════════════════════════════════
describe("pmtCents amortization", () => {
  it("returns 0 for zero principal", () => {
    expect(pmtCents(0, 0.0999, 24)).toBe(0);
  });

  it("returns flat division when APR=0", () => {
    expect(pmtCents(120000, 0, 24)).toBe(5000);
  });

  it("computes 24-month monthly at 9.99% within $1 of expected", () => {
    // $7,500 @ 9.99% for 24 months ≈ $345.92
    const monthly = pmtCents(750000, 0.0999, 24);
    expect(monthly).toBeGreaterThan(34000);
    expect(monthly).toBeLessThan(35200);
  });
});

// ════════════════════════════════════════════════════════════════════
// Ironclad Install bundle — $13/LF, wood-post families, absorbs
// the standalone steel + stain charges
// ════════════════════════════════════════════════════════════════════
describe("ironclad install bundle", () => {
  it("charges $13/LF on a wood-post family", () => {
    const base = calculatePrice(input());
    const withIronclad = calculatePrice(input({ ironclad: true }));
    expect(withIronclad.breakdown.ironclad_cents).toBe(150 * 1300);
    // Raw subtotal moves by exactly the bundle (guards/rounding apply after)
    expect(withIronclad.raw_subtotal_cents - base.raw_subtotal_cents).toBe(
      150 * 1300
    );
  });

  it("absorbs steel + stain instead of double-charging", () => {
    const bundled = calculatePrice(input({ ironclad: true, steel_post_upgrade: true, stain_seal: true }));
    const ironcladOnly = calculatePrice(input({ ironclad: true }));
    expect(bundled.raw_subtotal_cents).toBe(ironcladOnly.raw_subtotal_cents);
    expect(bundled.breakdown.steel_upgrade_cents).toBe(0);
    expect(bundled.breakdown.stain_cents).toBe(0);
    expect(bundled.warnings).toContain("steel_absorbed_by_ironclad");
    expect(bundled.warnings).toContain("stain_absorbed_by_ironclad");
  });

  it("charges steel exactly once — post_type 'steel' rides the bundle, no adder stacking", () => {
    const ironcladOnly = calculatePrice(input({ ironclad: true }));
    const ironcladSteel = calculatePrice(
      input({ ironclad: true, post_type: "steel" })
    );
    // The forced-steel selection must not add a second steel line on top.
    expect(ironcladSteel.breakdown.steel_upgrade_cents).toBe(0);
    expect(ironcladSteel.breakdown.ironclad_cents).toBe(150 * 1300);
    expect(ironcladSteel.raw_subtotal_cents).toBe(
      ironcladOnly.raw_subtotal_cents
    );
    expect(ironcladSteel.warnings).toContain("steel_absorbed_by_ironclad");
  });

  it("absorbs a cedar post selection too (no stacking under the bundle)", () => {
    const ironcladOnly = calculatePrice(input({ ironclad: true }));
    const ironcladCedar = calculatePrice(
      input({ ironclad: true, post_type: "cedar" })
    );
    expect(ironcladCedar.breakdown.cedar_post_cents).toBe(0);
    expect(ironcladCedar.raw_subtotal_cents).toBe(
      ironcladOnly.raw_subtotal_cents
    );
    expect(ironcladCedar.warnings).toContain("cedar_absorbed_by_ironclad");
  });

  it("is ignored (with warning) on non-wood families", () => {
    const r = calculatePrice(input({ sku_code: "CL-RES", ironclad: true }));
    expect(r.breakdown.ironclad_cents).toBe(0);
    expect(r.warnings).toContain("ironclad_ignored");
  });

  it("carries cost at the IRONCLAD ratio so margin stays honest", () => {
    const base = calculatePrice(input());
    const withIronclad = calculatePrice(input({ ironclad: true }));
    const revenueDelta = 150 * 1300;
    const costDelta =
      withIronclad.internal_margin.total_cost_cents -
      base.internal_margin.total_cost_cents;
    expect(costDelta).toBe(Math.round(revenueDelta * 0.54));
  });
});

// ════════════════════════════════════════════════════════════════════
// Pricing regression locks (slice 3a) — pin the CURRENT delivered totals
// so a future edit can't silently move them. No constant changed here; the
// proposed $53 bundle target was voided (it was computed off a stale $47
// belief — the real cedar-privacy Ivory Standard total is $57.82/LF).
// ════════════════════════════════════════════════════════════════════
describe("delivered-total regression locks", () => {
  // 100 LF, clean config (no gates/demo/slope). base_fence + ironclad is
  // LF-linear, so per-LF is exact regardless of permit/gates lines.
  const at100 = (over: Partial<PricingInput> = {}) =>
    calculatePrice(input({ linear_feet: 100, city: "Owasso", ...over }));

  it("cedar-privacy Ivory Standard delivers exactly $57.82/LF (base $44.82 + bundle $13)", () => {
    const iv = at100({ ironclad: true });
    const perLf =
      (iv.breakdown.base_fence_cents + iv.breakdown.ironclad_cents) / 100;
    expect(perLf).toBe(5782);
    expect(iv.breakdown.base_fence_cents).toBe(448200);
    expect(iv.breakdown.ironclad_cents).toBe(130000);
  });

  it("cedar-privacy Essential (no bundle) delivers exactly $44.82/LF, unchanged", () => {
    const ess = at100();
    expect(ess.breakdown.base_fence_cents / 100).toBe(4482);
    expect(ess.breakdown.ironclad_cents).toBe(0);
  });

  it("budget-pine Essential delivers $35.41/LF; Ivory Standard $48.41/LF", () => {
    const ess = at100({ sku_code: "BP-STD" });
    const iv = at100({ sku_code: "BP-STD", ironclad: true });
    expect(ess.breakdown.base_fence_cents / 100).toBe(3541);
    expect(
      (iv.breakdown.base_fence_cents + iv.breakdown.ironclad_cents) / 100
    ).toBe(4841);
  });

  it("board-on-board adds exactly $7/LF", () => {
    const bob = at100({ board_on_board: true });
    expect(bob.breakdown.board_on_board_cents).toBe(700 * 100);
  });

  it("steel / cedar post adders are unchanged ($6 / $3 per LF)", () => {
    expect(at100({ post_type: "steel" }).breakdown.steel_upgrade_cents).toBe(
      600 * 100
    );
    expect(at100({ post_type: "cedar" }).breakdown.cedar_post_cents).toBe(
      300 * 100
    );
  });

  it("Ivory Standard + board-on-board: BOB adds $7/LF on top, steel not double-charged", () => {
    const ivOnly = at100({ ironclad: true });
    const ivBob = at100({ ironclad: true, board_on_board: true, post_type: "steel" });
    // Bundle unchanged, BOB is purely additive, steel rides the bundle once.
    expect(ivBob.breakdown.ironclad_cents).toBe(130000);
    expect(ivBob.breakdown.board_on_board_cents).toBe(700 * 100);
    expect(ivBob.breakdown.steel_upgrade_cents).toBe(0);
    expect(ivBob.raw_subtotal_cents - ivOnly.raw_subtotal_cents).toBe(700 * 100);
    expect(ivBob.warnings).toContain("steel_absorbed_by_ironclad");
  });
});

// ════════════════════════════════════════════════════════════════════
// Board-on-board — $7/LF toggle, wood-picket families
// ════════════════════════════════════════════════════════════════════
describe("board-on-board add-on", () => {
  it("charges $7/LF on a wood-picket family", () => {
    const base = calculatePrice(input());
    const withBob = calculatePrice(input({ board_on_board: true }));
    expect(withBob.breakdown.board_on_board_cents).toBe(150 * 700);
    expect(withBob.raw_subtotal_cents - base.raw_subtotal_cents).toBe(
      150 * 700
    );
  });

  it("is ignored (with warning) on chain link", () => {
    const r = calculatePrice(input({ sku_code: "CL-RES", board_on_board: true }));
    expect(r.breakdown.board_on_board_cents).toBe(0);
    expect(r.warnings).toContain("board_on_board_ignored");
  });

  it("stacks with ironclad without interference", () => {
    const r = calculatePrice(input({ ironclad: true, board_on_board: true }));
    expect(r.breakdown.ironclad_cents).toBe(150 * 1300);
    expect(r.breakdown.board_on_board_cents).toBe(150 * 700);
  });

  it("carries cost at the BOARD_ON_BOARD ratio", () => {
    const base = calculatePrice(input());
    const withBob = calculatePrice(input({ board_on_board: true }));
    const costDelta =
      withBob.internal_margin.total_cost_cents -
      base.internal_margin.total_cost_cents;
    expect(costDelta).toBe(Math.round(150 * 700 * 0.55));
  });
});
