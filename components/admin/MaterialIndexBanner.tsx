import { TrendingDown, TrendingUp } from "lucide-react";
import { getFredSeries } from "@/lib/integrations/fred";
import { buildSignal, formatChange } from "@/lib/material-index/compute";
import { TRACKED_INDICES } from "@/lib/material-index/registry";

/**
 * Material-index banner for /admin/skus. Server component — runs the FRED
 * fetches on the server, renders flagged indices inline. Failures are
 * silently swallowed (no banner appears) rather than blocking the SKU list.
 *
 * Recommend repricing when a tracked PPI has moved more than its threshold
 * month-over-month. The banner lists the affected SKU families so the user
 * knows where to look.
 */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export async function MaterialIndexBanner() {
  // Skip entirely when FRED isn't configured — no point asking the user to
  // act on a banner whose source is broken.
  if (!process.env.FRED_API_KEY) return null;

  const results = await Promise.all(
    TRACKED_INDICES.map(async (idx) => {
      const res = await getFredSeries(idx.seriesId, 4);
      if (!res.ok) return null;
      return buildSignal(idx, res.observations);
    })
  );

  const flagged = results.filter(
    (s): s is NonNullable<typeof s> => !!s && s.flagged
  );
  if (flagged.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-amber-900">
        Commodity prices moved — consider repricing
      </div>
      <ul className="mt-2 space-y-1.5">
        {flagged.map((s) => {
          const up = s.changePct > 0;
          return (
            <li
              key={s.index.seriesId}
              className="flex items-start gap-2 text-xs"
            >
              {up ? (
                <TrendingUp
                  size={14}
                  className="mt-0.5 flex-shrink-0 text-amber-800"
                />
              ) : (
                <TrendingDown
                  size={14}
                  className="mt-0.5 flex-shrink-0 text-amber-800"
                />
              )}
              <div>
                <span className="font-semibold text-amber-900">
                  {s.index.label}
                </span>{" "}
                <span className="font-mono font-bold text-amber-900">
                  {formatChange(s.changePct)}
                </span>{" "}
                <span className="text-amber-900/70">
                  {fmtDate(s.priorDate)} → {fmtDate(s.latestDate)}
                </span>
                <div className="text-[11px] text-amber-900/70">
                  Affects: {s.index.families.join(", ")}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] text-amber-900/60">
        Source: FRED PPI (St. Louis Fed). Updates monthly. Thresholds set in{" "}
        <code className="rounded bg-amber-100 px-1 font-mono">
          lib/material-index/registry.ts
        </code>
        .
      </p>
    </div>
  );
}
