import { formatCents } from "@/lib/utils";

interface Props {
  materialCostCents: number | null;
  subLaborCostCents: number | null;
  grossMarginPct: string | number | null; // numeric column → string from drizzle
  marginFlag: "ok" | "warn" | "low" | null;
  selectedTierCents: number | null;
  tierBetterCents: number | null;
}

const FLAG_PILL = {
  ok: "bg-emerald-50 text-emerald-900 border-emerald-200",
  warn: "bg-amber-50 text-amber-900 border-amber-200",
  low: "bg-red-50 text-red-900 border-red-200",
} as const;

export function MarginPanel({
  materialCostCents,
  subLaborCostCents,
  grossMarginPct,
  marginFlag,
  selectedTierCents,
  tierBetterCents,
}: Props) {
  const pct =
    grossMarginPct == null
      ? null
      : (typeof grossMarginPct === "string"
          ? Number(grossMarginPct)
          : grossMarginPct) * 100;

  const basis = selectedTierCents ?? tierBetterCents;
  const totalCost =
    materialCostCents != null && subLaborCostCents != null
      ? materialCostCents + subLaborCostCents
      : null;
  const grossProfit =
    basis != null && totalCost != null ? basis - totalCost : null;

  return (
    <section
      className={
        "rounded-lg border bg-white p-4 " +
        (marginFlag ? FLAG_PILL[marginFlag] : "border-navy/10")
      }
      aria-label="Internal margin"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-navy/70">
          Internal margin
        </h2>
        {marginFlag && (
          <span className="text-[10px] font-bold uppercase tracking-wider">
            {marginFlag}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Row label="Tier basis" value={basis != null ? formatCents(basis) : "—"} />
        <Row label="Material" value={materialCostCents != null ? formatCents(materialCostCents) : "—"} />
        <Row label="Sub labor" value={subLaborCostCents != null ? formatCents(subLaborCostCents) : "—"} />
        <Row label="Total cost" value={totalCost != null ? formatCents(totalCost) : "—"} />
        <Row
          label="Gross profit"
          value={grossProfit != null ? formatCents(grossProfit) : "—"}
          emphasis
        />
        <Row
          label="Gross margin"
          value={pct != null ? `${pct.toFixed(1)}%` : "—"}
          emphasis
        />
      </div>

      <p className="mt-3 text-[11px] italic text-navy/50">
        Internal only — never shown to the customer. Captured at quote save.
      </p>
    </section>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-navy/50">
        {label}
      </div>
      <div
        className={
          "tabular-nums " + (emphasis ? "text-base font-bold text-navy" : "text-sm text-navy/80")
        }
      >
        {value}
      </div>
    </div>
  );
}
