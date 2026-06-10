import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { skus } from "@/lib/db/schema";
import { SKUS } from "@/lib/pricing/data";

// Sync ONLY customer-facing copy (spec bullets + description) from the file
// SKU definitions to the live DB. Deliberately does NOT touch prices,
// material/labor, market caps, or active flags — those are owned by the
// /admin/skus editor and must never be clobbered by a copy refresh.
async function main() {
  for (const s of SKUS) {
    await db
      .update(skus)
      .set({ specBullets: s.spec_bullets, description: s.description })
      .where(eq(skus.code, s.code));
    console.log(`copy synced: ${s.code}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("SYNC FAILED:", err?.message ?? err);
  process.exit(1);
});
