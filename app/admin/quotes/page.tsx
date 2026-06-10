import Link from "next/link";
import { and, asc, desc, eq, gte, ilike, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
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
  "refunded",
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
  view?: string;
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

const QUEUE_ROW_FIELDS = {
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
} as const;

/**
 * The action queue — the screen the operator opens every morning.
 * Three buckets, each answering "what do I do next", oldest first
 * (the oldest lead is the one going cold). The flat filter/search
 * table lives under ?view=all for record lookup.
 */
async function ActionQueue() {
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000);
  const days14 = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const days30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

  // 1. Money in hand, job not started — highest urgency.
  const handoff = (await db
    .select(QUEUE_ROW_FIELDS)
    .from(quotes)
    .where(and(eq(quotes.status, "deposit_paid"), isNull(quotes.hcpJobId)))
    .orderBy(asc(quotes.depositPaidAt))
    .limit(15)) as QuoteRow[];

  // 2. Priced with contact info, no deposit — the money pile to work.
  const followUp = (await db
    .select(QUEUE_ROW_FIELDS)
    .from(quotes)
    .where(
      and(
        gte(quotes.createdAt, days30),
        isNotNull(quotes.subtotalCents),
        isNotNull(quotes.customerEmail),
        or(eq(quotes.status, "finalized"), eq(quotes.status, "draft"))
      )
    )
    .orderBy(asc(quotes.createdAt))
    .limit(15)) as QuoteRow[];

  // 3. Drew a fence, never reached a price or left contact info.
  const abandoned = (await db
    .select(QUEUE_ROW_FIELDS)
    .from(quotes)
    .where(
      and(
        eq(quotes.status, "draft"),
        gte(quotes.createdAt, days14),
        lt(quotes.createdAt, hourAgo),
        or(isNull(quotes.subtotalCents), isNull(quotes.customerEmail))
      )
    )
    .orderBy(desc(quotes.createdAt))
    .limit(15)) as QuoteRow[];

  return (
    <div className="space-y-8">
      <QueueBucket
        title="Deposit paid — needs handoff"
        nextAction="Create the HCP job, order materials from the BOM, send the customer intro text."
        tone="green"
        rows={handoff}
        emptyText="Nothing waiting — every paid deposit has an HCP job."
      />
      <QueueBucket
        title="Priced, no deposit"
        nextAction="Follow up. They saw a number and have contact info on file — oldest first."
        tone="amber"
        rows={followUp}
        emptyText="No priced quotes awaiting a deposit in the last 30 days."
      />
      <QueueBucket
        title="Abandoned mid-funnel"
        nextAction="Recovery — they drew a fence but never finished. The cron texts them; call the big ones."
        tone="gray"
        rows={abandoned}
        emptyText="No abandoned drafts in the last 14 days."
      />
    </div>
  );
}

function QueueBucket({
  title,
  nextAction,
  tone,
  rows,
  emptyText,
}: {
  title: string;
  nextAction: string;
  tone: "green" | "amber" | "gray";
  rows: QuoteRow[];
  emptyText: string;
}) {
  const dot =
    tone === "green"
      ? "bg-emerald-500"
      : tone === "amber"
        ? "bg-amber-500"
        : "bg-navy/30";
  return (
    <section>
      <div className="flex items-baseline gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        <h2 className="text-base font-bold text-navy">{title}</h2>
        <span className="text-sm tabular-nums text-navy/50">{rows.length}</span>
      </div>
      <p className="mt-0.5 text-xs text-navy/50">{nextAction}</p>
      <div className="mt-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-navy/15 bg-white/50 p-4 text-sm text-navy/40">
            {emptyText}
          </div>
        ) : (
          <QuotesTable rows={rows} />
        )}
      </div>
    </section>
  );
}

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Queue is the default. Any filter/search/pagination param — or
  // ?view=all — switches to the flat browse table.
  const isQueue =
    searchParams.view !== "all" &&
    !searchParams.status &&
    !searchParams.q &&
    !searchParams.page &&
    !searchParams.range;
  if (isQueue) {
    return (
      <div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy">Action queue</h1>
            <p className="text-sm text-navy/60">
              What needs a human, oldest first.
            </p>
          </div>
          <Link
            href="/admin/quotes?view=all"
            className="rounded-md border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/5"
          >
            Browse all quotes →
          </Link>
        </div>
        <div className="mt-5">
          <ActionQueue />
        </div>
      </div>
    );
  }

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
          <Link
            href="/admin/quotes"
            className="text-xs font-semibold text-navy/50 hover:text-navy"
          >
            ← Action queue
          </Link>
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
