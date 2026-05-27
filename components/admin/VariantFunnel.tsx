import type { Experiment } from "@/lib/experiments/registry";

export interface VariantRow {
  variant: string; // variant key, or "(unassigned)"
  visited: number;
  started: number;
  drew: number;
  configured: number;
  finalized: number;
  deposited: number;
}

/**
 * Per-experiment variant funnel. Shows side-by-side conversion (deposit/visit)
 * for each variant. Designed to make A/B winners obvious without leaving the
 * existing funnel page.
 *
 * Sample size hint: if a variant's `visited` is < 30, the conversion rate is
 * statistically noisy — flag it with a muted style.
 */
export function VariantFunnel({
  experiment,
  rows,
}: {
  experiment: Experiment;
  rows: VariantRow[];
}) {
  // Pivot by variant key so we render in registry order (control first, etc.)
  const byKey = new Map(rows.map((r) => [r.variant, r]));
  const ordered: VariantRow[] = experiment.variants.map(
    (v) =>
      byKey.get(v.key) ?? {
        variant: v.key,
        visited: 0,
        started: 0,
        drew: 0,
        configured: 0,
        finalized: 0,
        deposited: 0,
      }
  );
  // Append "(unassigned)" if it has any data — sessions that visited before
  // the experiment activated, or before the variant cookie was set.
  const unassigned = byKey.get("(unassigned)");
  if (unassigned && unassigned.visited > 0) ordered.push(unassigned);

  const variantLabel = (key: string) =>
    experiment.variants.find((v) => v.key === key)?.label ?? key;

  return (
    <section className="rounded-lg border border-navy/10 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-navy">{experiment.name}</h3>
          {experiment.hypothesis && (
            <p className="mt-0.5 text-[11px] italic text-navy/50">
              {experiment.hypothesis}
            </p>
          )}
        </div>
        <span
          className={
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
            (experiment.active
              ? "bg-emerald-100 text-emerald-800"
              : "bg-navy/10 text-navy/60")
          }
        >
          {experiment.active ? "Active" : "Inactive"}
        </span>
      </div>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-navy/50">
            <th className="py-1 pr-2">Variant</th>
            <th className="py-1 px-2 text-right">Visited</th>
            <th className="py-1 px-2 text-right">Started</th>
            <th className="py-1 px-2 text-right">Deposited</th>
            <th className="py-1 pl-2 text-right">Conv.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy/5">
          {ordered.map((r) => {
            const conv = r.visited > 0 ? r.deposited / r.visited : 0;
            const lowSample = r.visited < 30;
            return (
              <tr key={r.variant}>
                <td className="py-1.5 pr-2">
                  <span className="font-medium text-navy">
                    {variantLabel(r.variant)}
                  </span>
                  {r.variant === "(unassigned)" && (
                    <span className="ml-1 text-[10px] text-navy/40">
                      (pre-launch)
                    </span>
                  )}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-navy/70">
                  {r.visited}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-navy/70">
                  {r.started}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-navy">
                  {r.deposited}
                </td>
                <td
                  className={
                    "py-1.5 pl-2 text-right tabular-nums " +
                    (lowSample ? "text-navy/40" : "font-semibold text-navy")
                  }
                >
                  {r.visited > 0 ? `${(conv * 100).toFixed(1)}%` : "—"}
                  {lowSample && r.visited > 0 && (
                    <span className="ml-1 text-[10px]">low n</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
