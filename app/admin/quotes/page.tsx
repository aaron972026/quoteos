import Link from "next/link";
import { and, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { quotes } from "@/lib/db/schema";
import { QuotesTable, type QuoteRow } from "@/components/admin/QuotesTable";
import { formatCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUSES = [
  "all",
  "draft",
  "finalized",
  "deposit_paid",
  "won",
  "lost",
  "expired",
] as const;
type StatusFilter = (typeof STATUSES)[number];

const RANGES = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: null,
} as const;
type RangeFilter = keyof typeof RANGES;

const PAGE_SIZE = 25;

interface SearchParams {
  status?: string;
  range?: string;
  q?: string;
  page?: string;
}

function parseStatus(v: string | undefined): StatusFilter {
  return STATUSES.find((s) => s === v) ?? "all";
}
function parseRange(v: string | undefined): RangeFilter {
  return (Object.keys(RANGES) as RangeFilter[]).find((r) => r === v) ?? "7d";
}
function parsePage(v: string | undefined): number {
  const n = Number(v ?? 1);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

function buildHref(base: Record<string, string>, override: Record<string, string | undefined>) {
  const merged: Record<string, string> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v == null || v === "") delete merged[k];
    else merged[k] = v;
  }
  const qs = new URLSearchParams(merged).toString();
  return `/admin/quotes${qs ? `?${qs}` : ""}`;
}

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const status = parseStatus(searchParams.status);
  const range = parseRange(searchParams.range);
  const q = (searchParams.q ?? "").trim();
  const page = parsePage(searchParams.page);

  // Compose WHERE clauses
  const where = [] as ReturnType<typeof eq>[];
  if (status !== "all") {
    where.push(eq(quotes.status, status));
  }
  if (range !== "all" && RANGES[range] != null) {
    where.push(gte(quotes.createdAt, new Date(Date.now() - RANGES[range]!)));
  }
  if (q) {
    where.push(
      or(
        ilike(quotes.addressLine, `%${q}%`),
        ilike(quotes.customerEmail, `%${q}%`),
        ilike(quotes.customerPhone, `%${q}%`),
        ilike(quotes.zip, `%${q}%`)
      )!
    );
  }
  const whereClause = where.length > 0 ? and(...where) : undefined;

  // Total count for pagination
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(quotes)
    .where(whereClause);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  // Page rows — only the fields the table needs
  const rows = (await db
    .select({
      id: quotes.id,
      quoteNumber: quotes.quoteNumber,
      status: quotes.status,
      customerName: quotes.customerName,
      customerEmail: quotes.customerEmail,
      addressLine: quotes.addressLine,
      city: quotes.city,
      zip: quotes.zip,
      linearFeet: quotes.linearFeet,
      skuCode: quotes.skuCode,
      selectedTierCents: quotes.selectedTierCents,
      subtotalCents: quotes.subtotalCents,
      marginFlag: quotes.marginFlag,
      createdAt: quotes.createdAt,
    })
    .from(quotes)
    .where(whereClause)
    .orderBy(desc(quotes.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)) as QuoteRow[];

  // Top-line numbers
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      paid: sql<number>`count(*) filter (where status = 'deposit_paid')::int`,
      lowMargin: sql<number>`count(*) filter (where margin_flag = 'low')::int`,
      avgTicket: sql<number>`coalesce(avg(coalesce(selected_tier_cents, subtotal_cents)), 0)::int`,
    })
    .from(quotes)
    .where(whereClause);

  const baseParams: Record<string, string> = {};
  if (status !== "all") baseParams.status = status;
  if (range !== "7d") baseParams.range = range;
  if (q) baseParams.q = q;

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Quotes</h1>
          <p className="text-sm text-navy/60">
            {count.toLocaleString()} match{count === 1 ? "" : "es"} this filter
          </p>
        </div>
      </div>

      {/* Top-line stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={stats.total.toLocaleString()} />
        <Stat label="Deposit paid" value={stats.paid.toLocaleString()} />
        <Stat
          label="Low-margin"
          value={stats.lowMargin.toLocaleString()}
          tone={stats.lowMargin > 0 ? "warn" : "default"}
        />
        <Stat
          label="Avg ticket"
          value={stats.avgTicket > 0 ? formatCents(stats.avgTicket) : "—"}
        />
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <FilterGroup label="Status">
          {STATUSES.map((s) => {
            const active = status === s;
            return (
              <Link
                key={s}
                href={buildHref(baseParams, {
                  status: s === "all" ? undefined : s,
                  page: undefined,
                })}
                className={
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors " +
                  (active
                    ? "bg-navy text-white"
                    : "bg-white text-navy/70 hover:bg-navy/5 border border-navy/10")
                }
              >
                {s === "all" ? "All" : s.replace("_", " ")}
              </Link>
            );
          })}
        </FilterGroup>
        <FilterGroup label="Range">
          {(Object.keys(RANGES) as RangeFilter[]).map((r) => {
            const active = range === r;
            return (
              <Link
                key={r}
                href={buildHref(baseParams, {
                  range: r === "7d" ? undefined : r,
                  page: undefined,
                })}
                className={
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors " +
                  (active
                    ? "bg-navy text-white"
                    : "bg-white text-navy/70 hover:bg-navy/5 border border-navy/10")
                }
              >
                {r === "all" ? "All time" : `Last ${r}`}
              </Link>
            );
          })}
        </FilterGroup>
        <form action="/admin/quotes" className="ml-auto">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          {range !== "7d" && <input type="hidden" name="range" value={range} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search address / email / zip…"
            className="h-8 w-64 rounded-md border border-navy/15 bg-white px-3 text-sm placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </form>
      </div>

      <div className="mt-4">
        <QuotesTable rows={rows} />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm text-navy/60">
          <div>
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-1">
            {page > 1 && (
              <Link
                href={buildHref(baseParams, {
                  page: page === 2 ? undefined : String(page - 1),
                })}
                className="rounded-md border border-navy/15 bg-white px-3 py-1 hover:bg-navy/5"
              >
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildHref(baseParams, { page: String(page + 1) })}
                className="rounded-md border border-navy/15 bg-white px-3 py-1 hover:bg-navy/5"
              >
                Next →
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  return (
    <div className="rounded-lg border border-navy/10 bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-navy/50">
        {label}
      </div>
      <div
        className={
          "mt-1 text-xl font-bold tabular-nums " +
          (tone === "warn" ? "text-amber-700" : "text-navy")
        }
      >
        {value}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-navy/40">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}
