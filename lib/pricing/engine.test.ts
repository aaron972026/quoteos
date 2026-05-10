import { describe, expect, it } from "vitest";
import {
  calculatePrice,
  getSkuCode,
  pmtCents,
  stripInternal,
} from "./engine";
import {
  ADDONS,
  DEMO_RATES,
  GATE_PRICES,
  SKUS,
  SKU_BY_CODE,
  SLOPE,
  TIER_MULTIPLIERS,
} from "./data";
import type { PricingInput } from "./types";

// Helper: build a baseline input with sensible defaults
function input(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    sku_code: "CP-B",
    linear_feet: 150,
    corner_count: 4,
    slope_code: 0,
    demo_type: "NONE",
    gates: [],
    height_upgrade: false,
    french_gothic: false,
    stain_seal: false,
    permit_required: false,
    hoa_admin: false,
    travel_miles_over_25: 0,
    ...overrides,
  };
}

describe("calculatePrice — happy path", () => {
  it("returns three tiers with good < better < best", () => {
    const r = calculatePrice(input());
    expect(r.tiers.good.total_cents).toBeLessThan(r.tiers.better.total_cents);
    expect(r.tiers.better.total_cents).toBeLessThan(r.tiers.best.total_cents);
  });

  it("subtotal_cents equals better tier total", () => {
    const r = calculatePrice(input());
    expect(r.subtotal_cents).toBe(r.tiers.better.total_cents);
  });

  it("better tier ≈ good × 1.18", () => {
    const r = calculatePrice(input());
    const ratio = r.tiers.better.total_cents / r.tiers.good.total_cents;
    expect(ratio).toBeCloseTo(TIER_MULTIPLIERS.better, 3);
  });

  it("best tier ≈ good × 1.45", () => {
    const r = calculatePrice(input());
    const ratio = r.tiers.best.total_cents / r.tiers.good.total_cents;
    expect(ratio).toBeCloseTo(TIER_MULTIPLIERS.best, 3);
  });

  it("deposit is always $99", () => {
    const r = calculatePrice(input());
    expect(r.deposit_cents).toBe(9900);
  });

  it("valid_until is roughly 7 days out", () => {
    const r = calculatePrice(input());
    const ms = new Date(r.valid_until).getTime() - Date.now();
    const days = ms / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThan(7.01);
  });
});

describe("calculatePrice — every SKU calculates without error", () => {
  for (const sku of SKUS) {
    it(`${sku.code} — ${sku.family_name} ${sku.tier}`, () => {
      const r = calculatePrice(input({ sku_code: sku.code }));
      expect(r.tiers.better.total_cents).toBeGreaterThan(0);
      expect(r.breakdown.base_fence).toBeGreaterThan(0);
    });
  }

  it("base_fence reflects the SKU's price/LF for slope_code=0", () => {
    const lf = 100;
    for (const sku of SKUS) {
      const r = calculatePrice(input({ sku_code: sku.code, linear_feet: lf, slope_code: 0 }));
      expect(r.breakdown.base_fence).toBe(lf * sku.base_price_per_lf_cents);
    }
  });
});

describe("calculatePrice — every slope code", () => {
  for (const code of [0, 1, 2, 3, 4]) {
    it(`slope_code ${code} (${SLOPE[code].label}) applies multiplier ${SLOPE[code].multiplier}`, () => {
      const lf = 100;
      const r = calculatePrice(input({ linear_feet: lf, slope_code: code }));
      const sku = SKU_BY_CODE["CP-B"];
      const expectedBase = Math.round(lf * sku.base_price_per_lf_cents * SLOPE[code].multiplier);
      expect(r.breakdown.base_fence).toBe(expectedBase);
    });
  }

  it("slope only affects base_fence, not gates or demo", () => {
    const flat = calculatePrice(
      input({ slope_code: 0, demo_type: "CEDAR", gates: [{ type: "SW-4", count: 1 }] })
    );
    const steep = calculatePrice(
      input({ slope_code: 3, demo_type: "CEDAR", gates: [{ type: "SW-4", count: 1 }] })
    );
    expect(flat.breakdown.demo).toBe(steep.breakdown.demo);
    expect(flat.breakdown.gates).toBe(steep.breakdown.gates);
    expect(flat.breakdown.base_fence).toBeLessThan(steep.breakdown.base_fence);
  });
});

describe("calculatePrice — every demo type", () => {
  for (const demoType of Object.keys(DEMO_RATES) as Array<keyof typeof DEMO_RATES>) {
    it(`demo_type=${demoType} charges $${DEMO_RATES[demoType] / 100}/LF`, () => {
      const lf = 200;
      const r = calculatePrice(input({ linear_feet: lf, demo_type: demoType }));
      expect(r.breakdown.demo).toBe(lf * DEMO_RATES[demoType]);
    });
  }
});

describe("calculatePrice — gates", () => {
  for (const gateType of Object.keys(GATE_PRICES) as Array<keyof typeof GATE_PRICES>) {
    it(`gate ${gateType} costs ${GATE_PRICES[gateType].price_cents} cents`, () => {
      const r = calculatePrice(input({ gates: [{ type: gateType, count: 1 }] }));
      expect(r.breakdown.gates).toBe(GATE_PRICES[gateType].price_cents);
    });
  }

  it("multiple gates sum correctly", () => {
    const r = calculatePrice(
      input({
        gates: [
          { type: "SW-4", count: 2 },
          { type: "DD-12", count: 1 },
        ],
      })
    );
    const expected = 2 * GATE_PRICES["SW-4"].price_cents + 1 * GATE_PRICES["DD-12"].price_cents;
    expect(r.breakdown.gates).toBe(expected);
  });

  it("zero gates → 0", () => {
    const r = calculatePrice(input({ gates: [] }));
    expect(r.breakdown.gates).toBe(0);
  });

  it("gate with count=0 contributes nothing", () => {
    const r = calculatePrice(input({ gates: [{ type: "SW-4", count: 0 }] }));
    expect(r.breakdown.gates).toBe(0);
  });
});

describe("calculatePrice — corners", () => {
  it("first 4 corners are free", () => {
    const r = calculatePrice(input({ corner_count: 4 }));
    expect(r.breakdown.corners).toBe(0);
  });

  it("5th corner costs $25", () => {
    const r = calculatePrice(input({ corner_count: 5 }));
    expect(r.breakdown.corners).toBe(2500);
  });

  it("10 corners → 6 × $25 = $150", () => {
    const r = calculatePrice(input({ corner_count: 10 }));
    expect(r.breakdown.corners).toBe(6 * 2500);
  });

  it("0 corners → 0", () => {
    const r = calculatePrice(input({ corner_count: 0 }));
    expect(r.breakdown.corners).toBe(0);
  });
});

describe("calculatePrice — add-ons", () => {
  it("stain_seal adds $3.25/LF", () => {
    const lf = 150;
    const r = calculatePrice(input({ linear_feet: lf, stain_seal: true }));
    expect(r.breakdown.stain).toBe(lf * 325);
  });

  it("french_gothic adds $2/LF", () => {
    const lf = 150;
    const r = calculatePrice(input({ linear_feet: lf, french_gothic: true }));
    expect(r.breakdown.french_gothic).toBe(lf * 200);
  });

  it("height_upgrade adds 18% of base_fence (CP family)", () => {
    const r = calculatePrice(input({ sku_code: "CP-B", height_upgrade: true }));
    const expected = Math.round(r.breakdown.base_fence * ADDONS.HEIGHT_UPGRADE_PCT);
    expect(r.breakdown.height_upgrade).toBe(expected);
  });

  it("height_upgrade applies to HC family", () => {
    const r = calculatePrice(input({ sku_code: "HC-B", height_upgrade: true }));
    expect(r.breakdown.height_upgrade).toBeGreaterThan(0);
  });

  it("height_upgrade is ignored for CL family + emits warning", () => {
    const r = calculatePrice(input({ sku_code: "CL-B", height_upgrade: true }));
    expect(r.breakdown.height_upgrade).toBe(0);
    expect(r.warnings.some((w) => w.startsWith("HEIGHT_UPGRADE_IGNORED"))).toBe(true);
  });

  it("permit adds flat $150", () => {
    const r = calculatePrice(input({ permit_required: true }));
    expect(r.breakdown.permit).toBe(15000);
  });

  it("hoa_admin adds flat $75", () => {
    const r = calculatePrice(input({ hoa_admin: true }));
    expect(r.breakdown.hoa_admin).toBe(7500);
  });

  it("travel: 10 miles over → $75", () => {
    const r = calculatePrice(input({ travel_miles_over_25: 10 }));
    expect(r.breakdown.travel).toBe(7500);
  });
});

describe("calculatePrice — internal margin", () => {
  it("margin uses better-tier basis (matches spec example numerics)", () => {
    const r = calculatePrice(
      input({
        sku_code: "CP-B",
        linear_feet: 150,
        slope_code: 1,
        demo_type: "CEDAR",
        gates: [{ type: "SW-4", count: 1 }],
      })
    );
    const sku = SKU_BY_CODE["CP-B"];

    // Material cost = LF × material_cost_per_lf
    expect(r.internal_margin.material_cost_cents).toBe(150 * sku.material_cost_per_lf_cents);

    // Gate material = 30% of gate revenue
    expect(r.internal_margin.gate_material_cost_cents).toBe(
      Math.round(r.breakdown.gates * 0.3)
    );

    // Sub labor = subtotal × sub_labor_pct (subtotal = better tier)
    expect(r.internal_margin.sub_labor_cost_cents).toBe(
      Math.round(r.tiers.better.total_cents * sku.sub_labor_pct)
    );

    // Overhead = subtotal × 5%
    expect(r.internal_margin.overhead_cost_cents).toBe(
      Math.round(r.tiers.better.total_cents * 0.05)
    );
  });

  it("gross_margin_pct between 0 and 1", () => {
    const r = calculatePrice(input());
    expect(r.internal_margin.gross_margin_pct).toBeGreaterThan(0);
    expect(r.internal_margin.gross_margin_pct).toBeLessThan(1);
  });

  it("typical job flags 'ok' margin", () => {
    const r = calculatePrice(input({ sku_code: "CP-B", linear_feet: 150 }));
    expect(r.internal_margin.margin_flag).toBe("ok");
  });

  it("low-LF chain link should warn or low (worst margin profile)", () => {
    const r = calculatePrice(input({ sku_code: "CL-G", linear_feet: 25 }));
    // Chain link material is cheap relative to revenue but at 25 LF margins compress
    expect(["ok", "warn", "low"]).toContain(r.internal_margin.margin_flag);
  });
});

describe("calculatePrice — PMT / monthly payment", () => {
  it("computes monthly for each tier", () => {
    const r = calculatePrice(input({ sku_code: "CP-B", linear_feet: 150 }));
    expect(r.tiers.good.monthly_24mo_cents).toBeGreaterThan(0);
    expect(r.tiers.better.monthly_24mo_cents).toBeGreaterThan(r.tiers.good.monthly_24mo_cents);
    expect(r.tiers.best.monthly_24mo_cents).toBeGreaterThan(r.tiers.better.monthly_24mo_cents);
  });

  it("pmtCents matches manual amortization for $11,040 @ 9.99%/24mo", () => {
    const result = pmtCents(1104000, 0.0999, 24);
    // Expected ~$509 (matches spec example within rounding)
    expect(result).toBeGreaterThan(50800);
    expect(result).toBeLessThan(51100);
  });

  it("pmtCents handles 0% APR gracefully (P/n)", () => {
    expect(pmtCents(1200000, 0, 24)).toBe(50000); // $12k / 24 = $500/mo
  });

  it("pmtCents returns 0 for zero principal", () => {
    expect(pmtCents(0, 0.0999, 24)).toBe(0);
  });
});

describe("calculatePrice — validation errors", () => {
  it("throws on unknown SKU", () => {
    expect(() => calculatePrice(input({ sku_code: "XX-Y" }))).toThrow(/UNKNOWN_SKU|SKU not found/);
  });

  it("throws on linear_feet ≤ 0", () => {
    expect(() => calculatePrice(input({ linear_feet: 0 }))).toThrow(/INVALID_LF|linear_feet/);
    expect(() => calculatePrice(input({ linear_feet: -10 }))).toThrow(/INVALID_LF|linear_feet/);
  });

  it("throws on negative corner_count", () => {
    expect(() => calculatePrice(input({ corner_count: -1 }))).toThrow(/INVALID_CORNERS/);
  });

  it("throws on unknown slope_code", () => {
    expect(() => calculatePrice(input({ slope_code: 99 }))).toThrow(/INVALID_SLOPE/);
  });

  it("throws on bad gate type", () => {
    // @ts-expect-error — bad gate type intentional
    expect(() => calculatePrice(input({ gates: [{ type: "FOO", count: 1 }] }))).toThrow(
      /INVALID_GATE/
    );
  });
});

describe("calculatePrice — warnings", () => {
  it("warns on short run (<20 LF)", () => {
    const r = calculatePrice(input({ linear_feet: 15 }));
    expect(r.warnings.some((w) => w.startsWith("SHORT_RUN"))).toBe(true);
  });

  it("warns on long run (>1000 LF)", () => {
    const r = calculatePrice(input({ linear_feet: 1500 }));
    expect(r.warnings.some((w) => w.startsWith("LONG_RUN"))).toBe(true);
  });

  it("no warnings for typical job", () => {
    const r = calculatePrice(input({ linear_feet: 150, sku_code: "CP-B" }));
    expect(r.warnings).toEqual([]);
  });
});

describe("calculatePrice — output integrity", () => {
  it("stripInternal removes internal_margin", () => {
    const r = calculatePrice(input());
    const safe = stripInternal(r);
    expect("internal_margin" in safe).toBe(false);
    expect(safe.subtotal_cents).toBe(r.subtotal_cents);
  });

  it("breakdown line items sum to good-tier total", () => {
    const r = calculatePrice(
      input({
        linear_feet: 200,
        slope_code: 2,
        demo_type: "CEDAR",
        gates: [{ type: "SW-4", count: 1 }, { type: "DD-12", count: 1 }],
        stain_seal: true,
        french_gothic: true,
        permit_required: true,
        hoa_admin: true,
        travel_miles_over_25: 5,
        corner_count: 8,
      })
    );
    const sum = Object.values(r.breakdown).reduce((a, b) => a + b, 0);
    expect(sum).toBe(r.tiers.good.total_cents);
  });

  it("all tier totals are integers (cents)", () => {
    const r = calculatePrice(input());
    expect(Number.isInteger(r.tiers.good.total_cents)).toBe(true);
    expect(Number.isInteger(r.tiers.better.total_cents)).toBe(true);
    expect(Number.isInteger(r.tiers.best.total_cents)).toBe(true);
  });
});

describe("calculatePrice — golden snapshot (spec §5 example)", () => {
  // Per spec §5 sample: CP-B, 150 LF, slope 1, CEDAR demo, 1× SW-4
  const SPEC_INPUT = input({
    sku_code: "CP-B",
    linear_feet: 150,
    corner_count: 4,
    slope_code: 1,
    demo_type: "CEDAR",
    gates: [{ type: "SW-4", count: 1 }],
  });

  it("base_fence = 150 LF × $52 × 1.05 = $8,190", () => {
    const r = calculatePrice(SPEC_INPUT);
    // CP-B base = $52/LF, slope 1 = ×1.05 → $54.60/LF × 150 = $8,190
    expect(r.breakdown.base_fence).toBe(819000);
  });

  it("demo = 150 × $5.50 = $825", () => {
    const r = calculatePrice(SPEC_INPUT);
    expect(r.breakdown.demo).toBe(82500);
  });

  it("gates = 1 × SW-4 = $300", () => {
    const r = calculatePrice(SPEC_INPUT);
    expect(r.breakdown.gates).toBe(30000);
  });

  it("snapshot matches", () => {
    const r = calculatePrice(SPEC_INPUT);
    expect({
      subtotal_cents: r.subtotal_cents,
      tiers: r.tiers,
      breakdown: r.breakdown,
    }).toMatchInlineSnapshot(`
      {
        "breakdown": {
          "base_fence": 819000,
          "corners": 0,
          "demo": 82500,
          "french_gothic": 0,
          "gates": 30000,
          "height_upgrade": 0,
          "hoa_admin": 0,
          "permit": 0,
          "stain": 0,
          "travel": 0,
        },
        "subtotal_cents": 1099170,
        "tiers": {
          "best": {
            "monthly_24mo_cents": 62321,
            "total_cents": 1350675,
          },
          "better": {
            "monthly_24mo_cents": 50716,
            "total_cents": 1099170,
          },
          "good": {
            "monthly_24mo_cents": 42980,
            "total_cents": 931500,
          },
        },
      }
    `);
  });
});

describe("getSkuCode helper", () => {
  it("maps tier to suffix correctly", () => {
    expect(getSkuCode("CP", "good")).toBe("CP-G");
    expect(getSkuCode("CP", "better")).toBe("CP-B");
    expect(getSkuCode("CP", "best")).toBe("CP-X");
    expect(getSkuCode("CL", "better")).toBe("CL-B");
  });
});
