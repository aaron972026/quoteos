import type { GateType, SkuFamily } from "@/lib/pricing/types";

/**
 * BOM = Bill of Materials. Crew-facing pull list generated from a finalized
 * quote's scope. Currently approximate — formulas land in the right
 * ballpark but a real installer should tune them per yard pricing and
 * preferred suppliers.
 */

export type Unit = "ea" | "lf" | "bag" | "gal" | "lb" | "box";

export interface BomLine {
  /** Internal material SKU — keep stable, used for yard pull lists. */
  sku: string;
  description: string;
  qty: number;
  unit: Unit;
  /** Optional note (e.g. "first 4 corners free already absorbed"). */
  note?: string;
}

export interface BomInputs {
  family: SkuFamily;
  /** SKU code for variant-specific material lookups (e.g. CPF-PRM). */
  skuCode: string;
  heightInches: number;
  heightUpgrade: boolean; // 6→8 ft for CPF / HCF families
  frenchGothic: boolean;
  stainSeal: boolean;
  linearFeet: number;
  cornerCount: number;
  gates: Array<{ type: GateType; count: number }>;
}

export interface BomBundle {
  inputs: BomInputs;
  /** Sections grouped by category — easier to read in the yard. */
  sections: Array<{
    label: string;
    lines: BomLine[];
  }>;
  /** Convenience: every line flattened in display order. */
  allLines: BomLine[];
  warnings: string[];
}
