import type { DemoType, GateType, Tier } from "./types";

// ─── SKUs ─────────────────────────────────────────────────────────────
// 5 families × 3 tiers = 15 SKUs. base_price and material_cost in cents.

export interface SkuData {
  code: string;
  family: "CP" | "HC" | "CL" | "OR" | "RR";
  family_name: string;
  tier: Tier;
  description: string;
  height_inches: number;
  base_price_per_lf_cents: number;
  material_cost_per_lf_cents: number;
  sub_labor_pct: number; // 0..1
  spec_bullets: string[];
  hero_image_url: string | null;
  sort_order: number;
}

export const SKUS: SkuData[] = [
  // ── Cedar Privacy ──────────────────────────────────────────────────
  {
    code: "CP-G",
    family: "CP",
    family_name: "Cedar Privacy",
    tier: "good",
    description: 'Standard 6\' cedar privacy with #2 grade pickets',
    height_inches: 72,
    base_price_per_lf_cents: 4200,
    material_cost_per_lf_cents: 1300,
    sub_labor_pct: 0.23,
    spec_bullets: ["6' tall", "Standard #2 cedar", "2-rail framing", "5-year workmanship"],
    hero_image_url: null,
    sort_order: 10,
  },
  {
    code: "CP-B",
    family: "CP",
    family_name: "Cedar Privacy",
    tier: "better",
    description: '6\' cedar privacy with premium pickets and 3-rail frame',
    height_inches: 72,
    base_price_per_lf_cents: 5200,
    material_cost_per_lf_cents: 1600,
    sub_labor_pct: 0.23,
    spec_bullets: ["6' tall", "Premium select cedar", "3-rail framing", "10-year workmanship"],
    hero_image_url: null,
    sort_order: 11,
  },
  {
    code: "CP-X",
    family: "CP",
    family_name: "Cedar Privacy",
    tier: "best",
    description: '6\' cedar privacy with hand-picked pickets and steel posts',
    height_inches: 72,
    base_price_per_lf_cents: 6800,
    material_cost_per_lf_cents: 2100,
    sub_labor_pct: 0.23,
    spec_bullets: ["6' tall", "Hand-picked clear cedar", "Steel posts in concrete", "Lifetime workmanship"],
    hero_image_url: null,
    sort_order: 12,
  },
  // ── Horizontal Cedar ───────────────────────────────────────────────
  {
    code: "HC-G",
    family: "HC",
    family_name: "Horizontal Cedar",
    tier: "good",
    description: 'Modern horizontal cedar slats, standard cedar',
    height_inches: 72,
    base_price_per_lf_cents: 5800,
    material_cost_per_lf_cents: 1900,
    sub_labor_pct: 0.24,
    spec_bullets: ["6' tall", "1×6 horizontal slats", "Wood posts", "5-year workmanship"],
    hero_image_url: null,
    sort_order: 20,
  },
  {
    code: "HC-B",
    family: "HC",
    family_name: "Horizontal Cedar",
    tier: "better",
    description: 'Premium horizontal cedar with steel posts',
    height_inches: 72,
    base_price_per_lf_cents: 7200,
    material_cost_per_lf_cents: 2400,
    sub_labor_pct: 0.24,
    spec_bullets: ["6' tall", "1×6 premium cedar", "Powder-coated steel posts", "10-year workmanship"],
    hero_image_url: null,
    sort_order: 21,
  },
  {
    code: "HC-X",
    family: "HC",
    family_name: "Horizontal Cedar",
    tier: "best",
    description: 'Designer horizontal cedar with hidden fasteners',
    height_inches: 72,
    base_price_per_lf_cents: 9200,
    material_cost_per_lf_cents: 3000,
    sub_labor_pct: 0.24,
    spec_bullets: ["6' tall", "Clear cedar, hidden fasteners", "Architectural posts", "Lifetime workmanship"],
    hero_image_url: null,
    sort_order: 22,
  },
  // ── Chain Link ─────────────────────────────────────────────────────
  {
    code: "CL-G",
    family: "CL",
    family_name: "Chain Link",
    tier: "good",
    description: '4\' galvanized chain link, basic',
    height_inches: 48,
    base_price_per_lf_cents: 1800,
    material_cost_per_lf_cents: 600,
    sub_labor_pct: 0.20,
    spec_bullets: ["4' tall", "Galvanized 11.5 ga", "Top rail", "3-year workmanship"],
    hero_image_url: null,
    sort_order: 30,
  },
  {
    code: "CL-B",
    family: "CL",
    family_name: "Chain Link",
    tier: "better",
    description: '5\' galvanized chain link with bottom tension',
    height_inches: 60,
    base_price_per_lf_cents: 2400,
    material_cost_per_lf_cents: 850,
    sub_labor_pct: 0.20,
    spec_bullets: ["5' tall", "Galvanized 9 ga", "Top + bottom rail", "5-year workmanship"],
    hero_image_url: null,
    sort_order: 31,
  },
  {
    code: "CL-X",
    family: "CL",
    family_name: "Chain Link",
    tier: "best",
    description: '6\' black-vinyl chain link, commercial grade',
    height_inches: 72,
    base_price_per_lf_cents: 3200,
    material_cost_per_lf_cents: 1100,
    sub_labor_pct: 0.20,
    spec_bullets: ["6' tall", "Black PVC-coated 9 ga", "Commercial grade", "10-year workmanship"],
    hero_image_url: null,
    sort_order: 32,
  },
  // ── Ornamental ─────────────────────────────────────────────────────
  {
    code: "OR-G",
    family: "OR",
    family_name: "Ornamental Steel",
    tier: "good",
    description: '4\' ornamental aluminum, residential grade',
    height_inches: 48,
    base_price_per_lf_cents: 4800,
    material_cost_per_lf_cents: 1700,
    sub_labor_pct: 0.22,
    spec_bullets: ["4' tall", "Aluminum, powder coat", "3-rail design", "5-year workmanship"],
    hero_image_url: null,
    sort_order: 40,
  },
  {
    code: "OR-B",
    family: "OR",
    family_name: "Ornamental Steel",
    tier: "better",
    description: '5\' ornamental steel with decorative top',
    height_inches: 60,
    base_price_per_lf_cents: 6200,
    material_cost_per_lf_cents: 2200,
    sub_labor_pct: 0.22,
    spec_bullets: ["5' tall", "Steel powder coat", "Decorative finials", "10-year workmanship"],
    hero_image_url: null,
    sort_order: 41,
  },
  {
    code: "OR-X",
    family: "OR",
    family_name: "Ornamental Steel",
    tier: "best",
    description: '6\' wrought iron-look steel, commercial grade',
    height_inches: 72,
    base_price_per_lf_cents: 8200,
    material_cost_per_lf_cents: 2900,
    sub_labor_pct: 0.22,
    spec_bullets: ["6' tall", "Heavy-gauge steel", "Commercial grade", "Lifetime workmanship"],
    hero_image_url: null,
    sort_order: 42,
  },
  // ── Ranch Rail ─────────────────────────────────────────────────────
  {
    code: "RR-G",
    family: "RR",
    family_name: "Ranch Rail",
    tier: "good",
    description: '3-rail cedar split rail, standard',
    height_inches: 42,
    base_price_per_lf_cents: 2200,
    material_cost_per_lf_cents: 750,
    sub_labor_pct: 0.21,
    spec_bullets: ["3.5' tall", "Cedar split rail", "3-rail", "3-year workmanship"],
    hero_image_url: null,
    sort_order: 50,
  },
  {
    code: "RR-B",
    family: "RR",
    family_name: "Ranch Rail",
    tier: "better",
    description: '4-rail cedar with mesh insert',
    height_inches: 48,
    base_price_per_lf_cents: 2800,
    material_cost_per_lf_cents: 950,
    sub_labor_pct: 0.21,
    spec_bullets: ["4' tall", "Cedar 4-rail", "Galvanized mesh insert", "5-year workmanship"],
    hero_image_url: null,
    sort_order: 51,
  },
  {
    code: "RR-X",
    family: "RR",
    family_name: "Ranch Rail",
    tier: "best",
    description: 'Premium 4-rail with steel posts and mesh',
    height_inches: 48,
    base_price_per_lf_cents: 3600,
    material_cost_per_lf_cents: 1250,
    sub_labor_pct: 0.21,
    spec_bullets: ["4' tall", "Premium cedar", "Steel posts + mesh", "10-year workmanship"],
    hero_image_url: null,
    sort_order: 52,
  },
];

export const SKU_BY_CODE: Record<string, SkuData> = SKUS.reduce(
  (acc, s) => ({ ...acc, [s.code]: s }),
  {} as Record<string, SkuData>
);

// ─── Slope adjustments ────────────────────────────────────────────────
// Multiplier applied to base_fence only (not adders).

export const SLOPE: Record<number, { label: string; multiplier: number }> = {
  0: { label: "Flat (<5%)", multiplier: 1.0 },
  1: { label: "Mild (5–10%)", multiplier: 1.05 },
  2: { label: "Moderate (10–20%)", multiplier: 1.1 },
  3: { label: "Severe (20%+)", multiplier: 1.15 },
  4: { label: "Extreme", multiplier: 1.2 },
};

// ─── Demo rates (cents per LF) ────────────────────────────────────────

export const DEMO_RATES: Record<DemoType, number> = {
  NONE: 0,
  CEDAR: 550,   // $5.50/LF
  CHAIN: 350,   // $3.50/LF
  METAL: 750,   // $7.50/LF
  CONC: 1500,   // $15.00/LF
};

// ─── Gate prices (cents each) ─────────────────────────────────────────

export const GATE_PRICES: Record<GateType, { price_cents: number; label: string }> = {
  "SW-4": { price_cents: 30000,  label: "4' single walk" },
  "SW-5": { price_cents: 35000,  label: "5' single walk" },
  "DD-10": { price_cents: 65000, label: "10' double drive" },
  "DD-12": { price_cents: 80000, label: "12' double drive" },
  "DD-14": { price_cents: 95000, label: "14' double drive" },
};

// ─── Tier multipliers ─────────────────────────────────────────────────

export const TIER_MULTIPLIERS: Record<Tier, number> = {
  good: 1.0,
  better: 1.18,
  best: 1.45,
};

// ─── Add-ons & misc constants (cents) ─────────────────────────────────

export const ADDONS = {
  STAIN_PER_LF_CENTS: 325,           // $3.25/LF
  FRENCH_GOTHIC_PER_LF_CENTS: 200,   // $2.00/LF
  HEIGHT_UPGRADE_PCT: 0.18,          // +18% on base_fence (CP/HC only)
  CORNER_FREE: 4,                    // first 4 corners free
  CORNER_OVER_CENTS: 2500,           // $25 each beyond
  PERMIT_FLAT_CENTS: 15000,          // $150
  HOA_ADMIN_FLAT_CENTS: 7500,        // $75
  TRAVEL_PER_MILE_CENTS: 750,        // $7.50/mile over 25
  GATE_MATERIAL_PCT: 0.30,           // 30% of gate revenue is material
  OVERHEAD_PCT: 0.05,                // 5% of subtotal (better-tier basis)
} as const;

// ─── Financing ────────────────────────────────────────────────────────

export const FINANCING = {
  APR: 0.0999,         // 9.99% Wisetack-equivalent
  MONTHS: 24,
  DEPOSIT_CENTS: 9900, // $99 hold
  QUOTE_VALID_DAYS: 7,
} as const;

// ─── Margin thresholds ────────────────────────────────────────────────

export const MARGIN_THRESHOLDS = {
  LOW: 0.4,    // <40% gross margin → "low"
  WARN: 0.45,  // <45% → "warn"
} as const;

// ─── Service area limits (LF guardrails for instant quote) ───────────

export const LF_LIMITS = {
  MIN: 20,    // below this: warn, push to call
  MAX: 1000,  // above this: warn, push to call
} as const;

// Families that allow 6'→8' height upgrade
export const HEIGHT_UPGRADE_FAMILIES: Set<string> = new Set(["CP", "HC"]);
