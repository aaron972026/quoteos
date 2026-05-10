import Link from "next/link";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { quotes, sessions } from "@/lib/db/schema";
import { FunnelStep } from "@/components/admin/FunnelStep";
import { SourceTable, type SourceRow } from "@/components/admin/SourceTable";
import { formatCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RANGES = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: null,
} as const;
type RangeKey = keyof typeof RANGES;

const RANGE_LABEL: Record<RangeKey, string> = {
  "24h": "Last 24h",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

interface SearchParams {
  range?: string;
}

function parseRange(v: string | undefined): RangeKey {
  return (Object.keys(RANGES) as RangeKey[]).find((r) => r === v) ?? "7d";
}

const DEPOSITED_STATUSES = ["deposit_paid", "won"] as const;

export default async function AdminFunnelPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const range = parseRange(searchParams.range);
  const sinceMs = RANGES[range];
  const since =
    sinceMs != null ? new Date(Date.now() - sinceMs) : new Date(0);

  // ─── Total sessions (top of the funnel) ────────────────────────
  const [{ visited }] = await db
    .select({ visited: sql<number>`count(*)::int` })
    .from(sessions)
    .where(gte(sessions.startedAt, since));

  // ─── Per-status quote counts + avg ticket (single query) ──────
  const [funnel] = await db
    .select({
      started: sql<number>`count(*)::int`,
      drew: sql<number>`count(*) filter (where ${quotes.linearFeet} > 0)::int`,
      configured: sql<number>`count(*) filter (where ${quotes.skuCode} is not null)::int`,
      finalized: sql<number>`count(*) filter (where ${quotes.status} in ('finalized','deposit_paid','won','lost','expired'))::int`,
      deposited: sql<number>`count(*) filter (where ${quotes.status} in ('deposit_paid','won'))::int`,
      avgTicket: sql<number>`coalesce(avg(coalesce(${quotes.selectedTierCents}, ${quotes.tierBetterCents})) filter (where ${quotes.status} in ('deposit_paid','won')), 0)::int`,
    })
    .from(quotes)
    .where(gte(quotes.createdAt, since));

  // ─── Tier mix among deposits ──────────────────────────────────
  const tierMixRaw = await db
    .select({
      tier: quotes.tier,
      count: sql<number>`count(*)::int`,
    })
    .from(quotes)
    .where(
      and(
        gte(quotes.createdAt, since),
        inArray(quotes.status, [...DEPOSITED_STATUSES])
      )
    )
    .groupBy(quotes.tier);
  const tierMix = { good: 0, better: 0, best: 0, unset: 0 };
  for (const t of tierMixRaw) {
    if (t.tier === "good" || t.tier === "better" || t.tier === "best") {
      tierMix[t.tier] = t.count;
    } else {
      tierMix.unset += t.count;
    }
  }
  const tierMixTotal = tierMix.good + tierMix.better + tierMix.best + tierMix.unset;

  // ─── Source breakdown ─────────────────────────────────────────
  const sourceRows = (await db
    .select({
      source: sessions.utmSource,
      visited: sql<number>`count(distinct ${sessions.id})::int`,
      started: sql<number>`count(${quotes.id})::int`,
      deposited: sql<number>`count(*) filter (where ${quotes.status} in ('deposit_paid','won'))::int`,
    })
    .from(sessions)
    .leftJoin(quotes, eq(quotes.sessionId, sessions.id))
    .where(gte(sessions.startedAt, since))
    .groupBy(sessions.utmSource)
    .orderBy(desc(sql`count(distinct ${sessions.id})`))
    .limit(12)) as SourceRow[];

  // ─── Headline numbers ─────────────────────────────────────────
  const conversion = visited > 0 ? funnel.deposited / visited : 0;
  const finalizeConversion =
    funnel.started > 0 ? funnel.finalized / funnel.started : 0;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Funnel</h1>
          <p className="text-sm text-navy/60">
            {RANGE_LABEL[range]} · visited → quote → deposit
          </p>
        </div>
        <div className="flex gap-1">
          {(Object.keys(RANGES) as RangeKey[]).map((r) => {
            const active = range === r;
            return (
              <Link
                key={r}
                href={r === "7d" ? "/admin/funnel" : `/admin/funnel?range=${r}`}
                className={
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors " +
                  (active
                    ? "bg-navy text-white"
                    : "bg-white text-navy/70 hover:bg-navy/5 border border-navy/10")
                }
              >
                {RANGE_LABEL[r]}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Visited" value={visited.toLocaleString()} />
        <KpiCard
          label="Deposits"
          value={funnel.deposited.toLocaleString()}
          tone={funnel.deposited > 0 ? "success" : "default"}
        />
        <KpiCard
          label="End-to-end conversion"
          value={visited > 0 ? `${(conversion * 100).toFixed(1)}%` : "—"}
        />
        <KpiCard
          label="Avg deposited ticket"
          value={funnel.avgTicket > 0 ? formatCents(funnel.avgTicket) : "—"}
        />
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-navy/70">
        Steps
      </h2>
      <p className="mt-1 text-xs text-navy/50">
        Bar shows % of top step. Drop column shows step-over-step loss.
      </p>
      <div className="mt-3 space-y-2">
        <FunnelStep
          label="Visited"
          hint="Session created — any landing page view"
          count={visited}
          total={visited}
        />
        <FunnelStep
          label="Quote started"
          hint="Address confirmed (Screen 2)"
          count={funnel.started}
          prevCount={visited}
          total={visited}
        />
        <FunnelStep
          label="Drew fence"
          hint="Linear feet > 0 (Screen 3)"
          count={funnel.drew}
          prevCount={funnel.started}
          total={visited}
        />
        <FunnelStep
          label="Configured SKU"
          hint="Tier and family picked (Screen 4)"
          count={funnel.configured}
          prevCount={funnel.drew}
          total={visited}
        />
        <FunnelStep
          label="Quote finalized"
          hint="Lock-in tier selected (Screen 5)"
          count={funnel.finalized}
          prevCount={funnel.configured}
          total={visited}
        />
        <FunnelStep
          label="Deposit paid"
          hint="Stripe Checkout completed"
          count={funnel.deposited}
          prevCount={funnel.finalized}
          total={visited}
          highlight
        />
      </div>

      <div className="mt-2 text-xs text-navy/50">
        Started → finalized:{" "}
        <span className="font-semibold text-navy/80">
          {(finalizeConversion * 100).toFixed(1)}%
        </span>{" "}
        · Spec target ≥60%
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tier mix */}
        <section className="rounded-lg border border-navy/10 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-navy/70">
            Tier mix (deposits)
          </h2>
          <p className="mt-1 text-xs text-navy/50">
            Which tier the customer locked in.
          </p>
          {tierMixTotal === 0 ? (
            <div className="mt-3 text-sm text-navy/60">No deposits yet.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {(
                [
                  ["Good", tierMix.good],
                  ["Better", tierMix.better],
                  ["Best", tierMix.best],
                  ...(tierMix.unset > 0
                    ? ([["(unset)", tierMix.unset]] as Array<[string, number]>)
                    : []),
                ] as Array<[string, number]>
              ).map(([label, count]) => {
                const p = tierMixTotal > 0 ? count / tierMixTotal : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-sm">
                      <span className="text-navy">{label}</span>
                      <span className="font-mono text-navy/70 tabular-nums">
                        {count} · {(p * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-navy/10">
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${(p * 100).toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Source breakdown */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-navy/70">
            Sources
          </h2>
          <p className="mt-1 text-xs text-navy/50">
            Top 12 by visit volume; ?utm_source on the landing URL.
          </p>
          <div className="mt-3">
            <SourceTable rows={sourceRows} />
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warn";
}) {
  return (
    <div className="rounded-lg border border-navy/10 bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-navy/50">
        {label}
      </div>
      <div
        className={
          "mt-1 text-xl font-bold tabular-nums " +
          (tone === "success"
            ? "text-emerald-700"
            : tone === "warn"
              ? "text-amber-700"
              : "text-navy")
        }
      >
        {value}
      </div>
    </div>
  );
}
