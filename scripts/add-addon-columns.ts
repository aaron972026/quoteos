import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

// Idempotent migration: add pricing-v2 add-on selection columns to the
// quotes table so /configure can restore them on reload. `IF NOT EXISTS`
// makes this safe to re-run. Non-destructive — additive, defaulted false.
const COLUMNS = [
  "steel_post_upgrade",
  "cap_rail_trim",
  "match_vinyl_posts",
  "ironclad",
  "board_on_board",
];

async function main() {
  for (const col of COLUMNS) {
    await db.execute(
      sql.raw(
        `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS ${col} boolean DEFAULT false;`
      )
    );
    console.log(`ok: ${col}`);
  }
  // Verify they're all present.
  const rows = await db.execute(
    sql.raw(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'quotes'
         AND column_name IN ('steel_post_upgrade','cap_rail_trim','match_vinyl_posts','ironclad','board_on_board')
       ORDER BY column_name;`
    )
  );
  console.log("present:", rows);
  process.exit(0);
}

main().catch((err) => {
  console.error("MIGRATION FAILED:", err?.message ?? err);
  process.exit(1);
});
