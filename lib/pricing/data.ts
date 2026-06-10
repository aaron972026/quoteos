// ─── Pricing Engine Constants ─────────────────────────────────────────
// Source of truth: _pricing/FencePros_Pricing_Model.csv-* sheets.
// All money in CENTS (integer). Last synced: 2026-05-26.

import type { DemoType, GateType, SkuFamily, MarginFlag } from "./types";

// ─── Global assumptions ───────────────────────────────────────────────
// Reflects the "assumptions" sheet. Cents stored as integers, pcts as decimals.

export interface PricingAssumptions {
  target_margin_pct: number;       // 0.45 — derives SKU base $/LF
  margin_floor_pct: number;        // 0.38 — hard min, engine raises price if below
  min_job_profit_cents: number;    // 80000 ($800) — engine raises price if below
  material_waste_pct: number;      // 0.05 — adds to material cost for overage
  overhead_per_lf_cents: number;   // 300 ($3/LF)
  range_swing_pct: number;         // 0.05 — display range = clamp(swing_pct × total, low, high)
  range_swing_min_cents: number;   // 20000 ($200)
  range_swing_max_cents: number;   // 120000 ($1200)
  round_to_cents: number;          // 5000 ($50) — final price rounded to nearest
  lf_min: number;                  // 20  — below this, warn "short_run"
  lf_max: number;                  // 1000 — above this, warn "long_run"
  margin_warn_pct: number;         // 0.45 — display margin flag = warn below this
}

export const ASSUMPTIONS: PricingAssumptions = {
  target_margin_pct: 0.45,
  margin_floor_pct: 0.38,
  min_job_profit_cents: 80000,
  material_waste_pct: 0.05,
  overhead_per_lf_cents: 300,
  range_swing_pct: 0.05,
  range_swing_min_cents: 20000,
  range_swing_max_cents: 120000,
  round_to_cents: 5000,
  lf_min: 20,
  lf_max: 1000,
  margin_warn_pct: 0.45,
};

// ─── SKUs ─────────────────────────────────────────────────────────────
// 11 SKUs across 4 families. Each SKU is its own price point.
// Per spec: SKU IS the tier — no good/better/best multiplier.

export interface SkuData {
  code: string;
  family: SkuFamily;
  family_name: string;
  /** Customer-friendly variant name shown on /configure (not the SKU code). */
  display_name: string;
  description: string;
  height_inches: number;
  material_cost_per_lf_cents: number; // raw material before waste
  labor_cost_per_lf_cents: number;    // sub-labor — dollars per LF, not %
  /** Pre-computed at target margin (= 45%). Engine uses this as the base. */
  base_price_per_lf_cents: number;
  market_max_per_lf_cents: number;    // sanity cap from competitor scan
  market_flag: "ok" | "ABOVE_MKT";    // if base > market_max, surfaces as warning
  spec_bullets: string[];
  hero_image_url: string | null;
  sort_order: number;
  /** Cedar wood OR Galv line — drives "steel post upgrade" availability. */
  posts_standard: "cedar_wood" | "galv_line";
}

/**
 * Compute base price/LF at the target margin.
 * Formula: price = (material × (1 + waste) + labor + overhead) / (1 - margin)
 *
 * Materialized at module load so the engine doesn't have to recompute on every
 * call. Re-deriving from raw inputs guarantees the SKUs stay in sync with the
 * ASSUMPTIONS table if those change.
 */
function pricePerLfCents(matCents: number, laborCents: number): number {
  const wasteAdj = matCents * (1 + ASSUMPTIONS.material_waste_pct);
  const totalCost = wasteAdj + laborCents + ASSUMPTIONS.overhead_per_lf_cents;
  return Math.round(totalCost / (1 - ASSUMPTIONS.target_margin_pct));
}

interface SkuSeed {
  code: string;
  family: SkuFamily;
  family_name: string;
  display_name: string;
  description: string;
  height_inches: number;
  material_dollars_per_lf: number;
  labor_dollars_per_lf: number;
  market_max_dollars_per_lf: number;
  market_flag: "ok" | "ABOVE_MKT";
  spec_bullets: string[];
  sort_order: number;
  posts_standard: "cedar_wood" | "galv_line";
}

// Standard warranty bullet shown on every SKU card. Reflects the FencePros
// Limited Warranty doc — 2-year workmanship + 5-year cedar post (or 15-year
// with the steel-post upgrade purchased on /configure).
const STD_WARRANTY_BULLET = "2-Year workmanship · 5-Year cedar post";

const SKU_SEEDS: SkuSeed[] = [
  // ── Budget Pine Fence (1 variant — its own family) ──────────────────
  // Pine is kept separate from cedar so the customer doesn't confuse the
  // entry-level pine with our cedar product line. KDAT (kiln-dried after
  // treatment) is the only pine we'll build with — see warranty doc.
  {
    code: "BP-STD",
    family: "BP",
    family_name: "Budget Pine",
    display_name: "KDAT Premium Pine",
    description: "KDAT pine, hand-selected, 3-rail framing.",
    height_inches: 72,
    material_dollars_per_lf: 9.5,
    labor_dollars_per_lf: 6.5,
    market_max_dollars_per_lf: 40,
    market_flag: "ok",
    spec_bullets: [
      "6' tall · 3-rail framing",
      "KDAT pine, hand-selected",
      "Wood posts, concrete-set",
      "12-Month no-warp guarantee",
      STD_WARRANTY_BULLET,
    ],
    sort_order: 5,
    posts_standard: "cedar_wood",
  },

  // ── Cedar Privacy Fence (2 variants) ────────────────────────────────
  {
    code: "CPF-PRM",
    family: "CPF",
    family_name: "Cedar Privacy",
    display_name: "Cedar Premium",
    description: "#1 cedar, dog-ear top, 3-rail framing.",
    height_inches: 72,
    material_dollars_per_lf: 13,
    labor_dollars_per_lf: 8,
    market_max_dollars_per_lf: 64,
    market_flag: "ok",
    spec_bullets: [
      "6' tall · 3-rail framing",
      "#1 cedar, dog-ear top",
      "Wood posts, concrete-set",
      STD_WARRANTY_BULLET,
    ],
    sort_order: 12,
    posts_standard: "cedar_wood",
  },
  {
    code: "CPF-EST",
    family: "CPF",
    family_name: "Cedar Privacy",
    display_name: "Cedar Estate",
    description: "#1/BTR cedar, board-on-board, kickboard, cap + trim.",
    height_inches: 72,
    material_dollars_per_lf: 17,
    labor_dollars_per_lf: 9,
    market_max_dollars_per_lf: 80,
    market_flag: "ok",
    spec_bullets: [
      "6' tall · 3-rail framing",
      "#1/BTR cedar, board-on-board",
      "Kickboard + cap + trim",
      "Wood posts, concrete-set",
      STD_WARRANTY_BULLET,
    ],
    sort_order: 13,
    posts_standard: "cedar_wood",
  },

  // ── Horizontal Cedar Fence (2 variants) ──────────────────────────────
  {
    code: "HCF-STD",
    family: "HCF",
    family_name: "Horizontal Cedar",
    display_name: "Horizontal Cedar",
    description: "1×6 cedar slats, modern horizontal layout.",
    height_inches: 72,
    material_dollars_per_lf: 15,
    labor_dollars_per_lf: 9,
    market_max_dollars_per_lf: 62,
    market_flag: "ok",
    spec_bullets: [
      "6' tall",
      "1×6 cedar horizontal slats",
      "Wood posts, concrete-set",
      STD_WARRANTY_BULLET,
    ],
    sort_order: 20,
    posts_standard: "cedar_wood",
  },
  {
    code: "HCF-PRM",
    family: "HCF",
    family_name: "Horizontal Cedar",
    display_name: "Horizontal Premium",
    description: "1×6 #1 cedar, mitered corners, hidden fasteners.",
    height_inches: 72,
    material_dollars_per_lf: 18.5,
    labor_dollars_per_lf: 10.5,
    market_max_dollars_per_lf: 84,
    market_flag: "ok",
    spec_bullets: [
      "6' tall",
      "1×6 #1 cedar, mitered corners",
      "Hidden fasteners",
      "Wood posts, concrete-set",
      STD_WARRANTY_BULLET,
    ],
    sort_order: 21,
    posts_standard: "cedar_wood",
  },

  // ── Chain Link (2 variants) ──────────────────────────────────────────
  {
    code: "CL-RES",
    family: "CL",
    family_name: "Chain Link",
    display_name: "Galvanized Residential",
    description: "Galvanized residential chain link with top rail.",
    height_inches: 48,
    material_dollars_per_lf: 5.5,
    labor_dollars_per_lf: 4.5,
    market_max_dollars_per_lf: 26,
    market_flag: "ok",
    spec_bullets: [
      "4' tall",
      "Galvanized residential gauge",
      "Galv line posts + top rail",
      "2-Year workmanship",
    ],
    sort_order: 30,
    posts_standard: "galv_line",
  },
  {
    code: "CL-VIN",
    family: "CL",
    family_name: "Chain Link",
    display_name: "Vinyl-Coated Black",
    description: "Black PVC-coated mesh, residential gauge.",
    height_inches: 60,
    material_dollars_per_lf: 8,
    labor_dollars_per_lf: 5,
    market_max_dollars_per_lf: 36,
    market_flag: "ok",
    spec_bullets: [
      "5' tall",
      "Black PVC-coated mesh",
      "Galv line posts + top rail",
      "2-Year workmanship",
    ],
    sort_order: 31,
    posts_standard: "galv_line",
  },

  // ── Ranch Rail (2 variants — 3-rail is the new entry point) ─────────
  {
    code: "RR-3",
    family: "RR",
    family_name: "Ranch Rail",
    display_name: "3-Rail Ranch",
    description: "3-rail cedar split rail, open-property feel.",
    height_inches: 48,
    material_dollars_per_lf: 8.5,
    labor_dollars_per_lf: 4.5,
    market_max_dollars_per_lf: 30,
    market_flag: "ok",
    spec_bullets: [
      "4' tall",
      "3-rail cedar",
      "Wood posts, concrete-set",
      STD_WARRANTY_BULLET,
    ],
    sort_order: 41,
    posts_standard: "cedar_wood",
  },
  {
    code: "RR-4",
    family: "RR",
    family_name: "Ranch Rail",
    display_name: "4-Rail Ranch + Mesh",
    description: "4-rail cedar with welded-wire mesh insert.",
    height_inches: 54,
    material_dollars_per_lf: 10.5,
    labor_dollars_per_lf: 5,
    market_max_dollars_per_lf: 34,
    market_flag: "ABOVE_MKT",
    spec_bullets: [
      "4.5' tall",
      "4-rail cedar",
      "Welded-wire mesh insert",
      "Wood posts, concrete-set",
      STD_WARRANTY_BULLET,
    ],
    sort_order: 42,
    posts_standard: "cedar_wood",
  },
];

export const SKUS: SkuData[] = SKU_SEEDS.map((s) => {
  const matCents = Math.round(s.material_dollars_per_lf * 100);
  const laborCents = Math.round(s.labor_dollars_per_lf * 100);
  return {
    code: s.code,
    family: s.family,
    family_name: s.family_name,
    display_name: s.display_name,
    description: s.description,
    height_inches: s.height_inches,
    material_cost_per_lf_cents: matCents,
    labor_cost_per_lf_cents: laborCents,
    base_price_per_lf_cents: pricePerLfCents(matCents, laborCents),
    market_max_per_lf_cents: Math.round(s.market_max_dollars_per_lf * 100),
    market_flag: s.market_flag,
    spec_bullets: s.spec_bullets,
    hero_image_url: null,
    sort_order: s.sort_order,
    posts_standard: s.posts_standard,
  };
});

export const SKU_BY_CODE: Record<string, SkuData> = SKUS.reduce(
  (acc, s) => ({ ...acc, [s.code]: s }),
  {} as Record<string, SkuData>
);

// ─── Slope adjustments ────────────────────────────────────────────────
// Slope surcharge applies to fence subtotal only. Slope-4 ("severe") uses
// the slope-3 percentage but emits a "slope_review_required" warning.

export const SLOPE: Record<number, { label: string; surcharge_pct: number; review_required: boolean }> = {
  0: { label: "Flat (<5%)",         surcharge_pct: 0,    review_required: false },
  1: { label: "Mild (5–10%)",       surcharge_pct: 0.05, review_required: false },
  2: { label: "Moderate (10–20%)",  surcharge_pct: 0.12, review_required: false },
  3: { label: "Steep (20%+)",       surcharge_pct: 0.18, review_required: false },
  4: { label: "Severe (review)",    surcharge_pct: 0.18, review_required: true  },
};

// ─── Demo rates (cents per LF) ────────────────────────────────────────
// Range was $3-5/LF in the CSV. Per spec: lock to low end.

export const DEMO_RATES: Record<DemoType, number> = {
  NONE: 0,
  CEDAR: 300,   // $3.00/LF
  CHAIN: 300,
  METAL: 300,
  CONC: 300,
};

// ─── Gate prices (cents each) ─────────────────────────────────────────

export const GATE_PRICES: Record<GateType, { price_cents: number; label: string }> = {
  W4:  { price_cents: 35000,  label: "4' walk gate"          },
  W5:  { price_cents: 42500,  label: "5' walk gate"          },
  D10: { price_cents: 85000,  label: "10' single-leaf drive" },
  D12: { price_cents: 110000, label: "12' single-leaf drive" },
  D16: { price_cents: 175000, label: "16' double-leaf drive" },
};

// ─── Add-ons ──────────────────────────────────────────────────────────

export const ADDONS = {
  STEEL_UPGRADE_PER_LF_CENTS: 500,     // $5/LF — wood post → steel post
  STAIN_PER_LF_CENTS: 800,             // $8/LF
  CAP_RAIL_PER_LF_CENTS: 400,          // $4/LF — cap rail + decorative trim (wood-picket families)
  MATCH_VINYL_POSTS_PER_LF_CENTS: 300, // $3/LF — black PVC-coated posts (CL-VIN only)
  ROCK_PER_POST_CENTS: 2500,           // $25/post (rock/hard-clay drilling)
  TEAR_CONCRETE_PER_POST_CENTS: 2000,  // $20/post for old concrete-set posts
  ACCESS_SURCHARGE_PCT: 0.08,          // +8% on fence subtotal for difficult access
  // Ironclad Install bundle: steel posts (lifetime rot warranty) + stain &
  // seal + 36" deep / 240+ lb concrete set + 3-yr workmanship + 15-yr post
  // & cedar-picket coverage. Priced below the $13 a-la-carte component sum
  // anchor ($5 steel + $8 standalone stain) once warranty value is stacked;
  // bundled cost ~= $7.05/LF (steel 2.75 + in-build stain 2.80 + deeper
  // set/extra concrete 1.00 + warranty reserve 0.50) -> 45.8% margin.
  IRONCLAD_PER_LF_CENTS: 1300,         // $13/LF
} as const;

// ─── Permits by city (cents) ──────────────────────────────────────────
// Tulsa confirmed at $75. BA/Bixby/Jenks TBD — default to $75 (Tulsa parity)
// until your city contacts confirm. Owasso confirmed at $0.

export const PERMITS: Record<string, number> = {
  Tulsa: 7500,
  "Broken Arrow": 7500,
  Bixby: 7500,
  Jenks: 7500,
  Owasso: 0,
};

export const PERMIT_DEFAULT_CENTS = 7500;

// ─── Cost-of-revenue ratios per add-on (for internal margin math) ─────
// The CSV doesn't itemize cost on add-ons, so we apply ratios derived from
// industry standards. These determine `internal_margin.total_cost_cents`.
// Tunable per future calibration against actual job data.

export const COST_RATIOS = {
  GATE: 0.50,            // 50% of gate revenue is material+sub-labor cost
  DEMO: 0.60,            // demo is mostly sub-labor
  STAIN: 0.45,           // stain materials + labor
  STEEL_UPGRADE: 0.55,
  CAP_RAIL: 0.50,        // cap rail trim — equal split material + labor
  MATCH_VINYL_POSTS: 0.60, // black PVC posts cost-up slightly more than galv
  ROCK_DRILLING: 0.55,
  TEAR_CONCRETE: 0.55,
  IRONCLAD: 0.54,        // bundled steel+stain+deep-set+warranty reserve (see ADDONS note)
  ACCESS: 0,             // pure margin add (no incremental cost in our model)
  PERMIT: 1.0,           // pass-through (we pay the city)
} as const;

// ─── Financing ────────────────────────────────────────────────────────

export const FINANCING = {
  APR: 0.0999,
  MONTHS: 24,
  DEPOSIT_CENTS: 9900,
  QUOTE_VALID_DAYS: 7,
} as const;

// ─── Margin display thresholds ────────────────────────────────────────
// Independent of the floor guard — used for admin "this job ran low" UI.

export const MARGIN_THRESHOLDS = {
  LOW: ASSUMPTIONS.margin_floor_pct, // = 0.38
  WARN: ASSUMPTIONS.margin_warn_pct, // = 0.45
} as const;

// Families that allow steel-post upgrade. Chain Link already has galv posts;
// wood-post families (cedar, horizontal cedar, budget pine) can upgrade
// wood → steel for the 15-year structural warranty.
export const STEEL_UPGRADE_FAMILIES: Set<SkuFamily> = new Set<SkuFamily>([
  "CPF",
  "HCF",
  "BP",
]);

// Families that allow cap rail + decorative trim. Same wood-picket set as
// steel upgrade today — kept as a separate constant so the two toggles can
// diverge if cap-rail support narrows.
export const CAP_RAIL_FAMILIES: Set<SkuFamily> = new Set<SkuFamily>([
  "CPF",
  "HCF",
  "BP",
]);

// ─── Pricing config bundle (injected into calculatePrice) ─────────────

export interface PricingConfig {
  assumptions: PricingAssumptions;
  skuByCode: Record<string, SkuData>;
  slope: typeof SLOPE;
  demoRates: typeof DEMO_RATES;
  gatePrices: typeof GATE_PRICES;
  addons: typeof ADDONS;
  permits: typeof PERMITS;
  permitDefaultCents: number;
  costRatios: typeof COST_RATIOS;
  financing: typeof FINANCING;
  marginThresholds: typeof MARGIN_THRESHOLDS;
  steelUpgradeFamilies: Set<SkuFamily>;
  capRailFamilies: Set<SkuFamily>;
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  assumptions: ASSUMPTIONS,
  skuByCode: SKU_BY_CODE,
  slope: SLOPE,
  demoRates: DEMO_RATES,
  gatePrices: GATE_PRICES,
  addons: ADDONS,
  permits: PERMITS,
  permitDefaultCents: PERMIT_DEFAULT_CENTS,
  costRatios: COST_RATIOS,
  financing: FINANCING,
  marginThresholds: MARGIN_THRESHOLDS,
  steelUpgradeFamilies: STEEL_UPGRADE_FAMILIES,
  capRailFamilies: CAP_RAIL_FAMILIES,
};

// Re-export MarginFlag for callers importing from data
export type { MarginFlag };
