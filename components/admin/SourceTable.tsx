export interface SourceRow {
  source: string | null;
  visited: number;
  started: number;
  deposited: number;
}

interface Props {
  rows: SourceRow[];
}

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${((n / d) * 100).toFixed(n / d < 0.1 ? 1 : 0)}%`;
}

export function SourceTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-navy/10 bg-white p-6 text-center text-sm text-navy/60">
        No traffic in this window.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-navy/10 bg-navy/[0.02] text-left text-xs uppercase tracking-wider text-navy/60">
          <tr>
            <th className="px-4 py-2.5">Source</th>
            <th className="px-4 py-2.5 text-right">Visited</th>
            <th className="px-4 py-2.5 text-right">Started</th>
            <th className="px-4 py-2.5 text-right">Deposited</th>
            <th className="px-4 py-2.5 text-right">Conv.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy/5">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-navy/[0.02]">
              <td className="px-4 py-2.5 font-medium text-navy">
                {r.source ?? <span className="italic text-navy/50">(direct)</span>}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-navy/80">
                {r.visited.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-navy/80">
                {r.started.toLocaleString()}
                <span className="ml-2 text-[10px] text-navy/40">
                  ({pct(r.started, r.visited)})
                </span>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-navy">
                {r.deposited.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-navy">
                {pct(r.deposited, r.visited)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
