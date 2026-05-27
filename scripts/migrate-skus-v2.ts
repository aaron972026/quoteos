/**
 * One-shot migration for pricing-model v2.
 *
 *   npx tsx -r dotenv/config scripts/migrate-skus-v2.ts dotenv_config_path=.env.local
 *
 * Adds new columns to the `skus` table and drops the NOT NULL constraint
 * on `tier`. Idempotent — safe to re-run; uses IF NOT EXISTS / IF EXISTS.
 */
import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Migrating skus → v2…");
  console.log(`DB: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@")}`);

  await db.execute(sql`SELECT 1`);

  const statements = [
    sql`ALTER TABLE skus ADD COLUMN IF NOT EXISTS labor_cost_per_lf_cents integer`,
    sql`ALTER TABLE skus ADD COLUMN IF NOT EXISTS market_max_per_lf_cents integer`,
    sql`ALTER TABLE skus ADD COLUMN IF NOT EXISTS market_flag text`,
    sql`ALTER TABLE skus ADD COLUMN IF NOT EXISTS posts_standard text`,
    sql`ALTER TABLE skus ALTER COLUMN tier DROP NOT NULL`,
    sql`ALTER TABLE skus ALTER COLUMN sub_labor_pct DROP NOT NULL`,
  ];

  for (const stmt of statements) {
    try {
      await db.execute(stmt);
    } catch (err) {
      // ALTER COLUMN ... DROP NOT NULL throws if already nullable on some
      // Postgres versions — log and continue
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("  skipped:", msg);
    }
  }

  console.log("Done. Now run: npm.cmd run db:seed");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
