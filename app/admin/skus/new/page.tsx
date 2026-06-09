import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SkuEditForm } from "@/components/admin/SkuEditForm";
import { createSku } from "../[code]/actions";

export const dynamic = "force-dynamic";

export default function AdminSkuNewPage() {
  return (
    <div>
      <Link
        href="/admin/skus"
        className="inline-flex items-center gap-1 text-sm text-navy/60 hover:text-navy"
      >
        <ArrowLeft size={14} /> All SKUs
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-navy">New SKU</h1>
      <p className="mb-6 text-sm text-navy/60">
        Adds an offering to the live catalog. Appears on /configure and in
        the pricing config as soon as it&rsquo;s saved with Active checked.
      </p>

      <div className="rounded-lg border border-navy/10 bg-white p-5">
        <SkuEditForm
          mode="create"
          code=""
          familyName=""
          tier=""
          heightInches={72}
          identity={{ height_inches: 72 }}
          initial={{
            description: "",
            base_price_per_lf_dollars: 0,
            material_cost_per_lf_dollars: 0,
            labor_cost_per_lf_dollars: 0,
            market_max_per_lf_dollars: null,
            spec_bullets: "",
            hero_image_url: "",
            active: false,
          }}
          action={createSku}
        />
      </div>
    </div>
  );
}
