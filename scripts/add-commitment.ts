import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

// Idempotent migration for the two-lane commitment step. Additive, non-
// destructive. Must run against prod BEFORE the code that reads these
// columns deploys.
async function main() {
  const cols: Array<[string, string]> = [
    ["commitment_lane", "text"],
    ["price_hold_expires_at", "timestamptz"],
    ["reserved_week_start", "date"],
  ];
  for (const [name, type] of cols) {
    await db.execute(
      sql.raw(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS ${name} ${type};`)
    );
    console.log(`ok: quotes.${name}`);
  }

  const present = await db.execute(
    sql.raw(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='quotes'
         AND column_name IN ('commitment_lane','price_hold_expires_at','reserved_week_start')
       ORDER BY column_name;`
    )
  );
  console.log("present:", present);
  process.exit(0);
}

main().catch((err) => {
  console.error("MIGRATION FAILED:", err?.message ?? err);
  process.exit(1);
});
