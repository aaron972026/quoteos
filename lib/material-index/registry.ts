import type { SkuFamily } from "@/lib/pricing/types";

/**
 * Tracked commodity indices. Each entry maps a FRED series ID to the SKU
 * families that depend on that commodity. When the index moves more than
 * `thresholdPct` month-over-month, the admin banner highlights affected
 * families for repricing review.
 *
 * Series picked for stability + monthly cadence:
 *  - Lumber PPI for wood families (CP, HC, RR)
 *  - Steel/iron PPI for chain link + ornamental (CL, OR)
 *
 * Add a new tracker: append an entry below. Retire one: remove it.
 * Thresholds are conservative — meant to catch real swings, not noise.
 */

export interface TrackedIndex {
  /** FRED series identifier. */
  seriesId: string;
  /** Display label in the admin banner. */
  label: string;
  /** SKU families whose cost basis depends on this commodity. */
  families: SkuFamily[];
  /** MoM percent change above which the banner flags this index. */
  thresholdPct: number;
}

export const TRACKED_INDICES: readonly TrackedIndex[] = [
  {
    // PPI: Sawmills, machine-stress-rated softwood lumber (covers cedar usage)
    seriesId: "WPU081101",
    label: "Softwood lumber PPI",
    families: ["CPF", "HCF", "RR", "BP"],
    thresholdPct: 3,
  },
  {
    // PPI: Iron and steel mills
    seriesId: "WPU101",
    label: "Iron & steel PPI",
    families: ["CL"],
    thresholdPct: 3,
  },
] as const;

/** Family → list of indices that affect it. */
export function indicesForFamily(family: SkuFamily): TrackedIndex[] {
  return TRACKED_INDICES.filter((i) => i.families.includes(family));
}
