import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

// Idempotent migration for the scope-confirmation visit scheduler:
//   1. appointment_status enum
//   2. appointments table + indexes
//   3. PARTIAL UNIQUE index on starts_at WHERE status='scheduled'
//      -> two customers cannot hold the same slot, but canceling frees it
//   4. visit_scheduled / visit_completed on the quote_status enum
//
// Safe to re-run. Must run against prod BEFORE the code that reads the
// appointments table deploys.
async function main() {
  await db.execute(
    sql.raw(`
    DO $$ BEGIN
      CREATE TYPE appointment_status AS ENUM ('scheduled','completed','canceled','no_show');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;`)
  );
  console.log("ok: appointment_status enum");

  await db.execute(
    sql.raw(`
    CREATE TABLE IF NOT EXISTS appointments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      quote_id uuid NOT NULL,
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      status appointment_status NOT NULL DEFAULT 'scheduled',
      customer_name text,
      customer_email text,
      customer_phone text,
      notes text,
      canceled_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`)
  );
  console.log("ok: appointments table");

  await db.execute(
    sql.raw(
      `CREATE INDEX IF NOT EXISTS appointments_quote_idx ON appointments (quote_id);`
    )
  );
  await db.execute(
    sql.raw(
      `CREATE INDEX IF NOT EXISTS appointments_starts_at_idx ON appointments (starts_at);`
    )
  );
  console.log("ok: appointments indexes");

  // The double-booking guard. Partial so canceled slots are rebookable.
  await db.execute(
    sql.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot_unique
       ON appointments (starts_at) WHERE status = 'scheduled';`
    )
  );
  console.log("ok: appointments_slot_unique (partial, status='scheduled')");

  for (const value of ["visit_scheduled", "visit_completed"]) {
    await db.execute(
      sql.raw(`ALTER TYPE quote_status ADD VALUE IF NOT EXISTS '${value}';`)
    );
    console.log(`ok: quote_status += '${value}'`);
  }

  const cols = await db.execute(
    sql.raw(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='appointments' ORDER BY ordinal_position;`
    )
  );
  console.log("appointments columns:", cols);
  process.exit(0);
}

main().catch((err) => {
  console.error("MIGRATION FAILED:", err?.message ?? err);
  process.exit(1);
});
