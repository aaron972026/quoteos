import { db } from "@/lib/db/client";
import { skus } from "@/lib/db/schema";

// Read-only probe: does the live skus table have v2 columns + rows?
async function main() {
  const rows = await db.select().from(skus);
  console.log(`rows: ${rows.length}`);
  const activeCount = rows.filter((r) => r.active).length;
  console.log(`active: ${activeCount}`);
  let v2Complete = 0;
  for (const r of rows) {
    const hasV2 =
      r.laborCostPerLfCents != null && r.basePricePerLfCents != null;
    if (hasV2) v2Complete++;
    console.log(
      `${r.code.padEnd(8)} active=${r.active ? "Y" : "n"} ` +
        `base=${r.basePricePerLfCents} mat=${r.materialCostPerLfCents} ` +
        `labor=${r.laborCostPerLfCents ?? "NULL"} ` +
        `mktMax=${r.marketMaxPerLfCents ?? "NULL"} ` +
        `posts=${r.postsStandard ?? "NULL"}`
    );
  }
  console.log(
    `\nv2-usable (labor+base present): ${v2Complete}/${rows.length}`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("CHECK FAILED:", err?.message ?? err);
  process.exit(1);
});
