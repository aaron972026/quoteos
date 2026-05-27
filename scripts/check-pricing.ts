/**
 * CLI sanity-check for the pricing engine. Mirrors the worked example in
 * _pricing/FencePros_Pricing_Model.csv-job-estimator so you can compare
 * the engine's numbers to your spreadsheet line-by-line.
 *
 * Usage:
 *   npx tsx scripts/check-pricing.ts
 *   npx tsx scripts/check-pricing.ts CPF-PRM 150 1 Tulsa 1 0
 *
 * Args: sku linear_feet slope_code city walk_gates drive_gates [stain] [steel] [demo_type]
 */
import { calculatePrice } from "../lib/pricing/engine";
import { SKU_BY_CODE } from "../lib/pricing/data";
import type { PricingInput } from "../lib/pricing/types";

function fmtCents(c: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(c / 100);
}

function row(label: string, value: string | number, indent = 0): void {
  const pad = " ".repeat(indent);
  const labelWidth = 40 - indent;
  console.log(
    `${pad}${label.padEnd(labelWidth)}${typeof value === "number" ? fmtCents(value) : value}`
  );
}

function divider(): void {
  console.log("─".repeat(60));
}

function header(text: string): void {
  console.log("\n" + text);
  console.log("═".repeat(60));
}

async function main() {
  const [
    skuCode = "CPF-PRM",
    linearFeetStr = "150",
    slopeCodeStr = "1",
    city = "Tulsa",
    walkGatesStr = "1",
    driveGatesStr = "0",
    stainStr = "false",
    steelStr = "false",
    demoType = "NONE",
  ] = process.argv.slice(2);

  const lf = Number(linearFeetStr);
  const slopeCode = Number(slopeCodeStr);
  const walkGates = Number(walkGatesStr);
  const driveGates = Number(driveGatesStr);

  if (!SKU_BY_CODE[skuCode]) {
    console.error(`Unknown SKU: ${skuCode}`);
    console.error("Available:", Object.keys(SKU_BY_CODE).join(", "));
    process.exit(1);
  }

  const sku = SKU_BY_CODE[skuCode];

  const gates: PricingInput["gates"] = [];
  if (walkGates > 0) gates.push({ type: "W4", count: walkGates });
  if (driveGates > 0) gates.push({ type: "D12", count: driveGates });

  const result = calculatePrice({
    sku_code: skuCode,
    linear_feet: lf,
    corner_count: 4,
    slope_code: slopeCode,
    demo_type: demoType as PricingInput["demo_type"],
    gates,
    stain_seal: stainStr === "true",
    steel_post_upgrade: steelStr === "true",
    city,
  });

  header("INPUTS");
  row("SKU", `${sku.code} — ${sku.family_name}`);
  row("Description", sku.description);
  row("Linear feet", `${lf}`);
  row("Slope code", `${slopeCode}`);
  row("City", city);
  row("Walk gates (W4)", `${walkGates}`);
  row("Drive gates (D12)", `${driveGates}`);
  row("Stain & seal", stainStr);
  row("Steel post upgrade", steelStr);
  row("Demo type", demoType);

  header("SKU COST-UP DERIVATION");
  row("Material $/LF (pre-waste)", sku.material_cost_per_lf_cents);
  row("Labor $/LF", sku.labor_cost_per_lf_cents);
  row("Waste 5% × material", Math.round(sku.material_cost_per_lf_cents * 0.05));
  row("Overhead $/LF", 300);
  divider();
  row("Base price $/LF @45% margin", sku.base_price_per_lf_cents);

  header("CALCULATION");
  row("Fence subtotal (w/ slope+access)", result.breakdown.base_fence_cents);
  row("  ↳ slope surcharge", result.breakdown.slope_surcharge_cents, 2);
  row("  ↳ access surcharge", result.breakdown.access_surcharge_cents, 2);
  row("Steel upgrade", result.breakdown.steel_upgrade_cents);
  row("Gates", result.breakdown.gates_cents);
  row("Demo", result.breakdown.demo_cents);
  row("Stain", result.breakdown.stain_cents);
  row("Rock drilling", result.breakdown.rock_drilling_cents);
  row("Tear concrete posts", result.breakdown.tear_concrete_cents);
  row("Permit", result.breakdown.permit_cents);
  divider();
  row("RAW SUBTOTAL (pre-guards)", result.raw_subtotal_cents);

  header("GUARDS + ROUNDING");
  row("Guards applied", result.guards_applied.join(", ") || "(none)");
  row("FINAL PRICE (rounded $50)", result.final_price_cents);

  header("CUSTOMER SEES");
  row(
    "Display range",
    `${fmtCents(result.display_range_low_cents)} – ${fmtCents(result.display_range_high_cents)}`
  );
  row(
    "Swing",
    result.display_range_high_cents - result.display_range_low_cents
  );

  header("INTERNAL MARGIN");
  row("Material cost", result.internal_margin.material_cost_cents);
  row("Labor cost", result.internal_margin.labor_cost_cents);
  row("Overhead cost", result.internal_margin.overhead_cost_cents);
  row("TOTAL JOB COST (est.)", result.internal_margin.total_cost_cents);
  divider();
  row("Gross profit", result.internal_margin.gross_profit_cents);
  row(
    "Gross margin",
    `${(result.internal_margin.gross_margin_pct * 100).toFixed(1)}% [${result.internal_margin.margin_flag}]`
  );
  row("Effective $/LF", result.effective_per_lf_cents);

  if (result.warnings.length) {
    header("WARNINGS");
    for (const w of result.warnings) console.log(`  ⚠ ${w}`);
  }
  console.log();
}

main().catch((err) => {
  console.error("check-pricing failed:", err);
  process.exit(1);
});
