import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

// Idempotent, additive, nullable — run on prod BEFORE deploying the code
// that reads it (same rule as the other migrations).
async function main() {
  await db.execute(
    sql.raw(
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS hold_email_sent_at timestamptz;`
    )
  );
  console.log("ok: quotes.hold_email_sent_at");
  process.exit(0);
}

main().catch((err) => {
  console.error("MIGRATION FAILED:", err?.message ?? err);
  process.exit(1);
});
