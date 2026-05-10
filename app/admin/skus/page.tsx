import Link from "next/link";
import { asc } from "drizzle-orm";
import { CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db/client";
import { skus } from "@/lib/db/schema";
import { formatCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface SearchParams {
  saved?: string;
}

export default async function AdminSkusPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const rows = await db.select().from(skus).orderBy(asc(skus.sortOrder));

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">SKUs</h1>
          <p className="text-sm text-navy/60">
            {rows.length} active + inactive. Edits write to{" "}
            <code className="rounded bg-navy/5 px-1 font-mono">skus</code> + an
            audit row in{" "}
            <code className="rounded bg-navy/5 px-1 font-mono">pricing_versions</code>.
          </p>
        </div>
      </div>

      {searchParams.saved && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <CheckCircle2 size={16} />
          Saved <span className="font-mono font-bold">{searchParams.saved}</span>.
          New audit row recorded in pricing_versions.
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-navy/10 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-navy/10 bg-navy/[0.02] text-left text-xs uppercase tracking-wider text-navy/60">
              <tr>
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Family</th>
                <th className="px-4 py-2.5">Tier</th>
                <th className="px-4 py-2.5 text-right">Base $/LF</th>
                <th className="px-4 py-2.5 text-right">Material $/LF</th>
                <th className="px-4 py-2.5 text-right">Sub %</th>
                <th className="px-4 py-2.5">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {rows.map((s) => (
                <tr key={s.code} className="hover:bg-navy/[0.02]">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/skus/${encodeURIComponent(s.code)}/edit`}
                      className="font-mono font-bold text-navy hover:text-accent hover:underline"
                    >
                      {s.code}
                    </Link>
                    <div className="mt-0.5 text-[10px] text-navy/40">
                      {s.heightInches}&quot; · {s.specBullets.length} bullets
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-navy">{s.familyName}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded bg-navy/5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy/70">
                      {s.tier}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-navy">
                    {formatCents(s.basePricePerLfCents)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-navy/70">
                    {formatCents(s.materialCostPerLfCents)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-navy/70">
                    {(Number(s.subLaborPct) * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5">
                    {s.active ? (
                      <span className="text-emerald-700">●</span>
                    ) : (
                      <span className="text-navy/30">○</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs italic text-navy/50">
        Note: the live pricing engine currently reads from{" "}
        <code className="rounded bg-navy/5 px-1 font-mono">lib/pricing/data.ts</code>{" "}
        at runtime, so admin edits persist + audit here but don&rsquo;t affect
        new quotes until the engine is rewired to read from the DB
        (Phase 1.5).
      </p>
    </div>
  );
}
