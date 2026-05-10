interface Props {
  label: string;
  hint?: string;
  count: number;
  total: number;             // denominator for the "of total" %
  prevCount?: number;        // for the step-over-step drop-off %
  highlight?: boolean;       // bold the row (e.g. for the conversion goal)
}

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${((n / d) * 100).toFixed(n / d < 0.1 ? 1 : 0)}%`;
}

export function FunnelStep({ label, hint, count, total, prevCount, highlight = false }: Props) {
  const ofTotal = total > 0 ? count / total : 0;
  const stepDrop =
    prevCount != null && prevCount > 0 ? 1 - count / prevCount : null;

  return (
    <div
      className={
        "grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-lg border bg-white px-4 py-3 " +
        (highlight
          ? "border-accent shadow-sm"
          : "border-navy/10")
      }
    >
      <div>
        <div className={highlight ? "text-base font-bold text-navy" : "text-sm font-semibold text-navy"}>
          {label}
        </div>
        {hint && <div className="text-xs text-navy/60">{hint}</div>}

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-navy/10">
          <div
            className={
              "h-full " + (highlight ? "bg-accent" : "bg-navy/60")
            }
            style={{ width: `${Math.min(100, ofTotal * 100).toFixed(1)}%` }}
          />
        </div>
      </div>

      <div className="text-right">
        <div className="text-xl font-bold tabular-nums text-navy">
          {count.toLocaleString()}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-navy/50">
          {pct(count, total)} of top
        </div>
      </div>

      <div className="w-20 text-right">
        {stepDrop != null ? (
          <>
            <div
              className={
                "text-sm font-semibold tabular-nums " +
                (stepDrop > 0.5
                  ? "text-red-700"
                  : stepDrop > 0.3
                    ? "text-amber-700"
                    : "text-navy/70")
              }
            >
              -{(stepDrop * 100).toFixed(0)}%
            </div>
            <div className="text-[10px] uppercase tracking-wider text-navy/50">
              drop
            </div>
          </>
        ) : (
          <div className="text-[10px] uppercase tracking-wider text-navy/40">
            top
          </div>
        )}
      </div>
    </div>
  );
}
