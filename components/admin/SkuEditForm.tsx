"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface InitialValues {
  description: string;
  base_price_per_lf_dollars: number; // engine stores cents; UI works in dollars
  material_cost_per_lf_dollars: number;
  sub_labor_pct_display: number; // 0..100 in UI; action divides by 100
  spec_bullets: string;            // newline-joined
  hero_image_url: string;
  active: boolean;
}

interface Props {
  code: string;
  familyName: string;
  tier: string;
  heightInches: number;
  initial: InitialValues;
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
}

export function SkuEditForm({
  code,
  familyName,
  tier,
  heightInches,
  initial,
  action,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  async function handleAction(formData: FormData) {
    setError(null);
    const result = await action(formData);
    if (!result.ok) setError(result.error ?? "Save failed");
  }

  return (
    <form action={handleAction} className="space-y-5">
      {/* Read-only header */}
      <div className="rounded-lg border border-navy/10 bg-navy/5 p-3 text-sm">
        <div className="flex items-baseline gap-3">
          <span className="font-mono font-bold text-navy">{code}</span>
          <span className="text-navy/70">
            {familyName} · {tier} · {heightInches}&quot;
          </span>
        </div>
        <div className="mt-1 text-xs italic text-navy/50">
          Family + tier + height are immutable in this UI — they change SKU identity.
        </div>
      </div>

      <Field
        label="Description"
        hint="One-line description shown in the configurator."
      >
        <textarea
          name="description"
          defaultValue={initial.description}
          required
          rows={2}
          className="w-full rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label="Base price"
          hint="$ per linear foot, customer-facing"
          adornment="$/LF"
        >
          <Input
            type="number"
            name="base_price_per_lf_dollars"
            defaultValue={initial.base_price_per_lf_dollars}
            min={0}
            step={0.01}
            required
            className="text-base"
          />
        </Field>

        <Field
          label="Material cost"
          hint="$ per linear foot — used for margin only, never shown to customer"
          adornment="$/LF"
        >
          <Input
            type="number"
            name="material_cost_per_lf_dollars"
            defaultValue={initial.material_cost_per_lf_dollars}
            min={0}
            step={0.01}
            required
            className="text-base"
          />
        </Field>

        <Field
          label="Sub labor %"
          hint="0–100 percentage of subtotal that goes to sub-labor"
          adornment="%"
        >
          <Input
            type="number"
            name="sub_labor_pct_display"
            defaultValue={initial.sub_labor_pct_display}
            min={0}
            max={100}
            step={0.1}
            required
            className="text-base"
          />
        </Field>

        <Field
          label="Active"
          hint="Inactive SKUs are hidden from /api/v1/skus"
        >
          <label className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              name="active"
              defaultChecked={initial.active}
              className="h-5 w-5 rounded border-navy/30 text-accent focus:ring-accent"
            />
            <span className="text-sm text-navy">Visible in customer flow</span>
          </label>
        </Field>
      </div>

      <Field
        label="Spec bullets"
        hint='One bullet per line — appears under the tier card on Screen 4 and on the PDF.'
      >
        <textarea
          name="spec_bullets"
          defaultValue={initial.spec_bullets}
          rows={5}
          className="w-full rounded-lg border border-navy/20 bg-white px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </Field>

      <Field label="Hero image URL" hint="Optional. Shown on the family card.">
        <Input
          type="url"
          name="hero_image_url"
          defaultValue={initial.hero_image_url}
          placeholder="https://…"
          className="text-base"
        />
      </Field>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-navy/10 pt-4">
        <SubmitButton />
        <span className="text-xs italic text-navy/50">
          A row is appended to <code className="font-mono">pricing_versions</code> on every save.
        </span>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" size={18} /> Saving…
        </>
      ) : (
        <>Save changes</>
      )}
    </Button>
  );
}

function Field({
  label,
  hint,
  adornment,
  children,
}: {
  label: string;
  hint?: string;
  adornment?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label className="text-sm font-semibold text-navy">{label}</label>
        {adornment && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-navy/40">
            {adornment}
          </span>
        )}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-navy/50">{hint}</p>}
    </div>
  );
}
