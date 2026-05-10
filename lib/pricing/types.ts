// ─── Pricing Engine Types ─────────────────────────────────────────────
// All money is in CENTS (integer). Never floats.

export type DemoType = "NONE" | "CEDAR" | "CHAIN" | "METAL" | "CONC";

export type GateType =
  | "SW-4"  //  4' single walk
  | "SW-5"  //  5' single walk
  | "DD-10" // 10' double drive
  | "DD-12" // 12' double drive
  | "DD-14"; // 14' double drive

export type SkuFamily = "CP" | "HC" | "CL" | "OR" | "RR";
export type Tier = "good" | "better" | "best";
export type MarginFlag = "ok" | "warn" | "low";

// ─── Inputs ───────────────────────────────────────────────────────────

export interface PricingGate {
  type: GateType;
  count: number;
}

export interface PricingInput {
  sku_code: string;          // e.g. "CP-B"
  linear_feet: number;       // post-rounding from drawing
  corner_count: number;      // total corners on the line
  slope_code: number;        // 0..4
  demo_type: DemoType;
  gates: PricingGate[];
  height_upgrade?: boolean;  // 6'→8' for CP / HC families only
  french_gothic?: boolean;   // premium top: +$2/LF
  stain_seal?: boolean;      // +$3.25/LF
  permit_required?: boolean; // flat $150
  hoa_admin?: boolean;       // flat $75
  travel_miles_over_25?: number; // $7.50/mile
  zip?: string;              // for service-zone lookup (informational)
}

// ─── Outputs ──────────────────────────────────────────────────────────

export interface TierTotal {
  total_cents: number;
  monthly_24mo_cents: number;
}

export interface PricingBreakdown {
  base_fence: number;
  height_upgrade: number;
  french_gothic: number;
  stain: number;
  demo: number;
  corners: number;
  gates: number;
  permit: number;
  hoa_admin: number;
  travel: number;
}

export interface InternalMargin {
  material_cost_cents: number;
  gate_material_cost_cents: number;
  sub_labor_cost_cents: number;
  overhead_cost_cents: number;
  total_cost_cents: number;
  gross_profit_cents: number;
  gross_margin_pct: number;
  margin_flag: MarginFlag;
}

export interface PricingResult {
  subtotal_cents: number; // = better-tier total (default selected)
  tiers: { good: TierTotal; better: TierTotal; best: TierTotal };
  deposit_cents: number;
  valid_until: string; // ISO 8601
  breakdown: PricingBreakdown; // dollar amounts at "good" (pre-tier) base
  internal_margin: InternalMargin;
  warnings: string[];
}

// ─── Errors ───────────────────────────────────────────────────────────

export class PricingError extends Error {
  constructor(public code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "PricingError";
  }
}
