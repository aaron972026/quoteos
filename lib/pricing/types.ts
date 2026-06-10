// ─── Pricing Engine Types ─────────────────────────────────────────────
// All money in CENTS (integer). Never floats for monetary fields.
//
// Model: cost-up to target gross margin (45%), with margin-floor (38%)
// and min-profit ($800) guard rails, $50 rounding, and a job-size-scaled
// display range. Each SKU is its own price point — no tier multiplier.
// See _pricing/FencePros_Pricing_Model.csv-* for the source of truth.

export type GateType = "W3" | "W4" | "W5" | "D10" | "D12" | "D16";
export type DemoType = "NONE" | "CEDAR" | "CHAIN" | "METAL" | "CONC";
export type SkuFamily = "CPF" | "HCF" | "CL" | "RR" | "BP";
export type MarginFlag = "ok" | "warn" | "low";

// ─── Inputs ───────────────────────────────────────────────────────────

export interface PricingGate {
  type: GateType;
  count: number;
}

export interface PricingInput {
  sku_code: string;             // e.g. "CPF-PRM"
  linear_feet: number;          // total LF of fence
  corner_count?: number;        // informational only — engine ignores in MVP
  slope_code: number;           // 0..4 (4 = "review required" — uses 22% multiplier and emits warning)
  demo_type: DemoType;          // "NONE" if no existing fence to remove
  demo_lf?: number;             // LF needing demo; defaults to linear_feet when demo_type != NONE
  gates: PricingGate[];
  stain_seal?: boolean;         // +$8/LF
  // Ironclad Install bundle (+$13/LF, wood-post families): steel posts +
  // stain & seal + 36"/240lb set + extended warranties. Absorbs the
  // standalone steel_post_upgrade and stain_seal charges when active.
  ironclad?: boolean;
  board_on_board?: boolean;    // +$7/LF overlapped pickets (wood-picket families)
  steel_post_upgrade?: boolean; // +$5/LF (wood-post families: CPF/HCF/BP — ignored elsewhere with warning)
  cap_rail_trim?: boolean;      // +$4/LF (Cedar Privacy + Horizontal Cedar + Budget Pine — wood-picket families)
  match_vinyl_posts?: boolean;  // +$3/LF (CL-VIN only — black PVC-coated posts to match the mesh)
  rock_drilling_posts?: number; // +$25/post
  tear_concrete_posts?: number; // +$20/post for old concrete-set post removal
  difficult_access?: boolean;   // +8% surcharge on fence subtotal
  city?: string;                // "Tulsa" | "Broken Arrow" | "Bixby" | "Jenks" | "Owasso"
  zip?: string;                 // informational (service-zone lookup)
}

// ─── Outputs ──────────────────────────────────────────────────────────

export interface PricingBreakdown {
  base_fence_cents: number;          // fence subtotal AFTER slope + access surcharges
  slope_surcharge_cents: number;     // delta from slope mul (already inside base_fence)
  access_surcharge_cents: number;    // delta from access (already inside base_fence)
  steel_upgrade_cents: number;
  ironclad_cents: number;            // +$13/LF Ironclad Install bundle (wood-post families)
  board_on_board_cents: number;      // +$7/LF board-on-board privacy (wood-picket families)
  cap_rail_cents: number;            // +$4/LF cap rail + trim (wood-picket families)
  match_vinyl_posts_cents: number;   // +$3/LF black PVC posts (CL-VIN only)
  gates_cents: number;
  demo_cents: number;
  stain_cents: number;
  rock_drilling_cents: number;
  tear_concrete_cents: number;
  permit_cents: number;
}

export interface InternalMargin {
  material_cost_cents: number;       // SKU material + waste, × LF
  labor_cost_cents: number;          // SKU labor × LF + ancillary labor on add-ons
  overhead_cost_cents: number;       // overhead/LF × LF
  total_cost_cents: number;          // sum of all cost lines (incl. permit pass-through)
  gross_profit_cents: number;        // final_price - total_cost
  gross_margin_pct: number;          // 0..1
  margin_flag: MarginFlag;
}

export interface PricingResult {
  final_price_cents: number;            // post-guards, post-rounding
  display_range_low_cents: number;      // = final - swing (swing = clamp(5% × final, $200, $1200))
  display_range_high_cents: number;     // = final
  deposit_cents: number;                // $99 refundable hold
  monthly_24mo_cents: number;           // 24-mo amortized at FINANCING.APR (for Wisetack messaging)
  valid_until: string;                  // ISO 8601
  breakdown: PricingBreakdown;
  raw_subtotal_cents: number;           // pre-guards, pre-rounding (sum of breakdown lines)
  guards_applied: string[];             // [] or subset of ["margin_floor", "min_profit"]
  internal_margin: InternalMargin;
  warnings: string[];                   // e.g. "slope_review_required", "above_market"
  effective_per_lf_cents: number;       // final_price / linear_feet, rounded
}

// ─── Errors ───────────────────────────────────────────────────────────

export class PricingError extends Error {
  constructor(public code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "PricingError";
  }
}
