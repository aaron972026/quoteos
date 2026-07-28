import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

// Idempotent, additive, nullable-with-default — run on prod BEFORE deploying
// the code that reads it (same rule as the other migrations).
//
// Backfill maps the retired steel_post_upgrade flag (and any Ivory Standard /
// ironclad quote, which now implies steel) onto the new post_type column so
// existing quotes render the correct post + warranty. steel_post_upgrade is
// left in place — never dropped.
async function main() {
  await db.execute(
    sql.raw(
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS post_type text DEFAULT 'pt';`
    )
  );
  await db.execute(
    sql.raw(
      `UPDATE quotes
         SET post_type = 'steel'
       WHERE (steel_post_upgrade = true OR ironclad = true)
         AND (post_type IS NULL OR post_type = 'pt');`
    )
  );
  console.log("ok: quotes.post_type added + steel rows backfilled");
  process.exit(0);
}

main().catch((err) => {
  console.error("MIGRATION FAILED:", err?.message ?? err);
  process.exit(1);
});
