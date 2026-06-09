import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { skus } from "@/lib/db/schema";
import { SkuEditForm } from "@/components/admin/SkuEditForm";
import { updateSku } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminSkuEditPage({
  params,
}: {
  params: { code: string };
}) {
  const code = decodeURIComponent(params.code);
  const [sku] = await db.select().from(skus).where(eq(skus.code, code)).limit(1);
  if (!sku) notFound();

  // Wrap the action so the form can call it as `(formData) => …` without
  // having to thread the code through itself.
  async function action(formData: FormData) {
    "use server";
    return updateSku(code, formData);
  }

  return (
    <div>
      <Link
        href="/admin/skus"
        className="inline-flex items-center gap-1 text-sm text-navy/60 hover:text-navy"
      >
        <ArrowLeft size={14} /> All SKUs
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-navy">Edit SKU</h1>
      <p className="mb-6 text-sm text-navy/60">
        Persists to the <code className="font-mono">skus</code> table and
        records a snapshot in{" "}
        <code className="font-mono">pricing_versions</code>.
      </p>

      <div className="rounded-lg border border-navy/10 bg-white p-5">
        <SkuEditForm
          code={sku.code}
          familyName={sku.familyName}
          tier={sku.tier ?? "—"}
          heightInches={sku.heightInches}
          initial={{
            description: sku.description,
            base_price_per_lf_dollars: sku.basePricePerLfCents / 100,
            material_cost_per_lf_dollars: sku.materialCostPerLfCents / 100,
            labor_cost_per_lf_dollars: (sku.laborCostPerLfCents ?? 0) / 100,
            market_max_per_lf_dollars:
              sku.marketMaxPerLfCents != null
                ? sku.marketMaxPerLfCents / 100
                : null,
            spec_bullets: (sku.specBullets ?? []).join("\n"),
            hero_image_url: sku.heroImageUrl ?? "",
            active: sku.active,
          }}
          action={action}
        />
      </div>
    </div>
  );
}
