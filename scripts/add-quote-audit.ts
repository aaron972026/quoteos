import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

// Idempotent migration for the admin quote-management feature:
//   1. quote_audit table (price adjust / resend / refund trail)
//   2. 'refunded' value on the quote_status enum
// Non-destructive and safe to re-run. Must run against prod BEFORE the
// code that reads quote_audit / writes the refunded status deploys.
async function main() {
  await db.execute(
    sql.raw(`
    CREATE TABLE IF NOT EXISTS quote_audit (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      quote_id uuid NOT NULL,
      action text NOT NULL,
      reason text,
      before_cents integer,
      after_cents integer,
      meta jsonb,
      actor text NOT NULL DEFAULT 'admin',
      created_at timestamptz NOT NULL DEFAULT now()
    );`)
  );
  console.log("ok: quote_audit table");

  await db.execute(
    sql.raw(
      `CREATE INDEX IF NOT EXISTS quote_audit_quote_idx ON quote_audit (quote_id);`
    )
  );
  console.log("ok: quote_audit_quote_idx");

  // ADD VALUE IF NOT EXISTS is safe to re-run (Postgres 12+).
  await db.execute(
    sql.raw(`ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'refunded';`)
  );
  console.log("ok: quote_status += 'refunded'");

  const cols = await db.execute(
    sql.raw(
      `SELECT column_name FROM information_schema.columns WHERE table_name='quote_audit' ORDER BY ordinal_position;`
    )
  );
  console.log("quote_audit columns:", cols);
  process.exit(0);
}

main().catch((err) => {
  console.error("MIGRATION FAILED:", err?.message ?? err);
  process.exit(1);
});
