"use client";

import { useFormStatus } from "react-dom";
import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface InitialValues {
  description: string;
  base_price_per_lf_dollars: number; // engine stores cents; UI works in dollars
  material_cost_per_lf_dollars: number;
  labor_cost_per_lf_dollars: number;
  market_max_per_lf_dollars: number | null;
  spec_bullets: string; // newline-joined
  hero_image_url: string;
  active: boolean;
}

interface IdentityValues {
  code: string;
  family: string;
  family_name: string;
  height_inches: number;
  tier: string; // "good" | "better" | "best" | ""
}

interface Props {
  /** "edit" locks identity fields; "create" makes them inputs. */
  mode?: "edit" | "create";
  code: string;
  familyName: string;
  tier: string;
  heightInches: number;
  initial: InitialValues;
  /** Only used in create mode to prefill the identity inputs. */
  identity?: Partial<IdentityValues>;
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
}

// Mirrors lib/pricing/data.ts pricePerLfCents — the cost-up model:
// price = (material × 1.05 waste + labor + $3 overhead/LF) ÷ (1 − 45%)
function suggestedAt45(materialD: number, laborD: number): number {
  return (materialD * 1.05 + laborD + 3.0) / 0.55;
}

export function SkuEditForm({
  mode = "edit",
  code,
  familyName,
  tier,
  heightInches,
  initial,
  identity,
  action,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [materialD, setMaterialD] = useState(
    initial.material_cost_per_lf_dollars
  );
  const [laborD, setLaborD] = useState(initial.labor_cost_per_lf_dollars);
  const [baseD, setBaseD] = useState(initial.base_price_per_lf_dollars);
  const [marketMaxD, setMarketMaxD] = useState<string>(
    initial.market_max_per_lf_dollars != null
      ? String(initial.market_max_per_lf_dollars)
      : ""
  );

  const suggested = suggestedAt45(materialD || 0, laborD || 0);
  const marketMaxNum = marketMaxD === "" ? null : Number(marketMaxD);
  const aboveMarket = marketMaxNum != null && baseD > marketMaxNum;
  const impliedMarginPct =
    baseD > 0
      ? (1 - ((materialD || 0) * 1.05 + (laborD || 0) + 3.0) / baseD) * 100
      : 0;

  async function handleAction(formData: FormData) {
    setError(null);
    const result = await action(formData);
    if (!result.ok) setError(result.error ?? "Save failed");
  }

  return (
    <form action={handleAction} className="space-y-5">
      {mode === "edit" ? (
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
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="SKU code" hint="Uppercase, unique. e.g. CPF-PRO">
            <Input
              name="code"
              defaultValue={identity?.code ?? ""}
              required
              pattern="[A-Z0-9-]{2,16}"
              placeholder="CPF-PRO"
              className="font-mono text-base uppercase"
            />
          </Field>
          <Field label="Family code" hint="Groups variants on /configure. e.g. CPF">
            <Input
              name="family"
              defaultValue={identity?.family ?? ""}
              required
              pattern="[A-Z0-9]{2,8}"
              placeholder="CPF"
              className="font-mono text-base uppercase"
            />
          </Field>
          <Field label="Family name" hint="Customer-facing. e.g. Cedar Privacy">
            <Input
              name="family_name"
              defaultValue={identity?.family_name ?? ""}
              required
              className="text-base"
            />
          </Field>
          <Field label="Height" hint="Inches" adornment="in">
            <Input
              type="number"
              name="height_inches"
              defaultValue={identity?.height_inches ?? 72}
              min={24}
              max={120}
              required
              className="text-base"
            />
          </Field>
          <Field
            label="Tier slot"
            hint="Drives the Good/Better/Best card layout on /configure"
          >
            <select
              name="tier"
              defaultValue={identity?.tier ?? ""}
              className="w-full rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">— none —</option>
              <option value="good">Good</option>
              <option value="better">Better</option>
              <option value="best">Best</option>
            </select>
          </Field>
        </div>
      )}

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
          label="Material cost"
          hint="$ per LF, raw before 5% waste — never shown to customer"
          adornment="$/LF"
        >
          <Input
            type="number"
            name="material_cost_per_lf_dollars"
            value={materialD}
            onChange={(e) => setMaterialD(Number(e.target.value))}
            min={0}
            step={0.01}
            required
            className="text-base"
          />
        </Field>

        <Field
          label="Labor cost"
          hint="$ per LF sub-labor (pricing v2 — replaces the legacy sub-labor %)"
          adornment="$/LF"
        >
          <Input
            type="number"
            name="labor_cost_per_lf_dollars"
            value={laborD}
            onChange={(e) => setLaborD(Number(e.target.value))}
            min={0}
            step={0.01}
            required
            className="text-base"
          />
        </Field>

        <Field
          label="Base price"
          hint="$ per linear foot, customer-facing"
          adornment="$/LF"
        >
          <Input
            type="number"
            name="base_price_per_lf_dollars"
            value={baseD}
            onChange={(e) => setBaseD(Number(e.target.value))}
            min={0}
            step={0.01}
            required
            className="text-base"
          />
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <span className="text-navy/60">
              Suggested @45% margin:{" "}
              <span className="font-mono font-semibold text-navy">
                ${suggested.toFixed(2)}
              </span>
              {" · "}this price implies{" "}
              <span
                className={
                  impliedMarginPct < 38
                    ? "font-semibold text-red-700"
                    : impliedMarginPct < 45
                      ? "font-semibold text-amber-700"
                      : "font-semibold text-green-700"
                }
              >
                {impliedMarginPct.toFixed(1)}%
              </span>
            </span>
            <button
              type="button"
              onClick={() => setBaseD(Math.round(suggested * 100) / 100)}
              className="rounded border border-navy/20 px-2 py-0.5 text-[11px] font-semibold text-navy hover:bg-navy/5"
            >
              Use suggested
            </button>
          </div>
        </Field>

        <Field
          label="Market max"
          hint="Competitor-scan cap — base above this flags ABOVE_MKT on quotes. Blank = no cap."
          adornment="$/LF"
        >
          <Input
            type="number"
            name="market_max_per_lf_dollars"
            value={marketMaxD}
            onChange={(e) => setMarketMaxD(e.target.value)}
            min={0}
            step={0.01}
            className="text-base"
          />
          {aboveMarket && (
            <div className="mt-1.5 text-xs font-semibold text-amber-700">
              Base price exceeds market max — quotes will carry the
              above_market warning.
            </div>
          )}
        </Field>

        <Field label="Active" hint="Inactive SKUs are hidden from the funnel AND excluded from the live pricing config">
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
        hint="One bullet per line — appears under the tier card on Screen 4 and on the PDF."
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
        <SubmitButton label={mode === "create" ? "Create SKU" : "Save changes"} />
        <span className="text-xs italic text-navy/50">
          A row is appended to <code className="font-mono">pricing_versions</code> on every save.
          Live quotes pick up changes immediately.
        </span>
      </div>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" size={18} /> Saving…
        </>
      ) : (
        <>{label}</>
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
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label className="text-sm font-semibold text-navy">{label}</label>
        {adornment && (
          <span className="font-mono text-xs text-navy/50">{adornment}</span>
        )}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-navy/50">{hint}</p>}
    </div>
  );
}
