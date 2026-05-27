/**
 * One-shot DB pre-deploy verification.
 *
 *   npx tsx -r dotenv/config scripts/verify-db.ts dotenv_config_path=.env.local
 *
 * Checks:
 *   - v2 SKU columns exist
 *   - 9 SKUs seeded
 *   - tier/sub_labor_pct are nullable
 */
import { db } from "../lib/db/client";
import { skus } from "../lib/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Verifying Supabase DB state for production deploy…");
  console.log(`DB: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@")}`);
  console.log();

  await db.execute(sql`SELECT 1`);

  // 1. SKU columns — must include the v2 additions
  type ColRow = { column_name: string; is_nullable: string };
  const colRows = (await db.execute(sql`
    select column_name, is_nullable
    from information_schema.columns
    where table_name = 'skus'
    order by ordinal_position;
  `)) as unknown as ColRow[];

  const colSet = new Set(colRows.map((r) => r.column_name));
  const required = [
    "labor_cost_per_lf_cents",
    "market_max_per_lf_cents",
    "market_flag",
    "posts_standard",
  ];
  console.log("─── SKU columns ───");
  for (const c of required) {
    const ok = colSet.has(c);
    console.log(`  ${ok ? "✓" : "✗"} ${c}`);
  }

  const tierRow = colRows.find((r) => r.column_name === "tier");
  const subLaborRow = colRows.find((r) => r.column_name === "sub_labor_pct");
  console.log(
    `  ${tierRow?.is_nullable === "YES" ? "✓" : "✗"} tier (nullable: ${tierRow?.is_nullable})`
  );
  console.log(
    `  ${subLaborRow?.is_nullable === "YES" ? "✓" : "✗"} sub_labor_pct (nullable: ${subLaborRow?.is_nullable})`
  );

  // 2. SKU count + family map
  console.log("\n─── SKU catalog ───");
  const rows = await db.select().from(skus);
  console.log(`  Total SKUs: ${rows.length}`);
  const byFam = new Map<string, string[]>();
  for (const r of rows) {
    const arr = byFam.get(r.family) ?? [];
    arr.push(`${r.code} (${r.tier ?? "—"})`);
    byFam.set(r.family, arr);
  }
  for (const [fam, items] of Array.from(byFam.entries()).sort()) {
    console.log(`  ${fam}: ${items.join(", ")}`);
  }

  const expectedFamilies = ["BP", "CPF", "HCF", "CL", "RR"];
  const missing = expectedFamilies.filter((f) => !byFam.has(f));
  if (missing.length) {
    console.log(`  ✗ Missing families: ${missing.join(", ")}`);
  } else {
    console.log("  ✓ All 5 families present");
  }
  if (rows.length === 9) {
    console.log("  ✓ Expected 9 SKUs");
  } else {
    console.log(`  ✗ Expected 9 SKUs, found ${rows.length}`);
  }

  // 3. Reminder for storage bucket (can't check from here — needs Storage API)
  console.log("\n─── Manual check still required ───");
  console.log(
    "  ⚠ Supabase Storage bucket 'quote-photos' must exist + be PUBLIC."
  );
  console.log("  Dashboard → Storage → confirm bucket exists with Public flag.");

  process.exit(0);
}

main().catch((err) => {
  console.error("Verify failed:", err);
  process.exit(1);
});
