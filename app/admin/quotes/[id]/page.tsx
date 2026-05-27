import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown } from "lucide-react";
import { eq } from "drizzle-orm";
import type { Feature, LineString, Polygon } from "geojson";
import { db } from "@/lib/db/client";
import { quotes, skus } from "@/lib/db/schema";
import { QuoteDetailMap } from "@/components/admin/QuoteDetailMap";
import { MarginPanel } from "@/components/admin/MarginPanel";
import { ScopeList } from "@/components/admin/ScopeList";
import { formatCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_PILL: Record<string, string> = {
  draft: "bg-navy/10 text-navy/70",
  finalized: "bg-amber-100 text-amber-900",
  deposit_paid: "bg-green-100 text-green-900",
  won: "bg-emerald-100 text-emerald-900",
  lost: "bg-red-50 text-red-900",
  expired: "bg-navy/5 text-navy/40",
};

const TIER_LABEL = { good: "Good", better: "Better", best: "Best" } as const;

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminQuoteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [q] = await db.select().from(quotes).where(eq(quotes.id, params.id)).limit(1);
  if (!q) notFound();

  const [sku] = q.skuCode
    ? await db
        .select({ familyName: skus.familyName, description: skus.description })
        .from(skus)
        .where(eq(skus.code, q.skuCode))
        .limit(1)
    : [null as null | { familyName: string; description: string }];

  const lat = q.lat != null ? Number(q.lat) : null;
  const lng = q.lng != null ? Number(q.lng) : null;
  const geometry =
    q.geometry as Feature<LineString | Polygon> | LineString | Polygon | null;
  const gates =
    (q.gates as Array<{ type: string; count: number }> | null) ?? [];

  const propertyPairs: Array<[string, React.ReactNode]> = [
    ["Address", q.addressLine],
    [
      "City / Zip",
      [q.city, q.state, q.zip].filter(Boolean).join(", ") || null,
    ],
    [
      "Coords",
      lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : null,
    ],
  ];

  const scopePairs: Array<[string, React.ReactNode]> = [
    [
      "Linear feet",
      q.linearFeet != null ? `${Number(q.linearFeet).toFixed(0)} LF` : null,
    ],
    ["Corners", q.cornerCount],
    [
      "Slope",
      q.slopeCode != null
        ? `Code ${q.slopeCode}${q.slopeSelfReported ? " (self-reported)" : ""}`
        : null,
    ],
    [
      "SKU",
      q.skuCode ? (
        <span>
          <span className="font-mono">{q.skuCode}</span>
          {sku && <span className="text-navy/50"> — {sku.familyName}</span>}
        </span>
      ) : null,
    ],
    ["Tier (legacy)", q.tier ? TIER_LABEL[q.tier] : null],
    [
      "Add-ons",
      [
        q.heightUpgrade && "Height 8'",
        q.frenchGothic && "French Gothic",
        q.stainSeal && "Stain & seal",
      ]
        .filter(Boolean)
        .join(" · ") || null,
    ],
    [
      "Demo",
      q.demoRequired
        ? `Yes — ${q.demoType ?? "type unknown"}`
        : "No tear-out",
    ],
    [
      "Gates",
      gates.length > 0
        ? gates.map((g) => `${g.count}× ${g.type}`).join(", ")
        : null,
    ],
  ];

  const customerPairs: Array<[string, React.ReactNode]> = [
    ["Name", q.customerName],
    ["Email", q.customerEmail],
    ["Phone", q.customerPhone],
    ["Session", <span key="s" className="font-mono text-xs">{q.sessionId}</span>],
  ];

  const lifecyclePairs: Array<[string, React.ReactNode]> = [
    ["Created", fmtDate(q.createdAt)],
    ["Updated", fmtDate(q.updatedAt)],
    ["Price valid until", fmtDate(q.priceValidUntil)],
    ["Deposit paid at", fmtDate(q.depositPaidAt)],
    [
      "Stripe payment intent",
      q.stripePaymentIntent ? (
        <span className="font-mono text-xs">{q.stripePaymentIntent}</span>
      ) : null,
    ],
    [
      "GHL contact",
      q.ghlContactId ? <span className="font-mono text-xs">{q.ghlContactId}</span> : null,
    ],
    [
      "HCP job",
      q.hcpJobId ? <span className="font-mono text-xs">{q.hcpJobId}</span> : null,
    ],
  ];

  return (
    <div>
      <Link
        href="/admin/quotes"
        className="inline-flex items-center gap-1 text-sm text-navy/60 hover:text-navy"
      >
        <ArrowLeft size={14} /> All quotes
      </Link>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold text-navy">
            {q.quoteNumber ?? q.id.slice(0, 8)}
          </h1>
          <p className="text-sm text-navy/60">{q.addressLine ?? "(no address yet)"}</p>
        </div>
        <div className="flex items-center gap-2">
          {q.skuCode && q.linearFeet != null && (
            <a
              href={`/api/admin/quotes/${q.id}/bom`}
              className="inline-flex items-center gap-1.5 rounded-md border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy/30 hover:bg-navy/5"
            >
              <FileDown size={14} /> Download BOM
            </a>
          )}
          <span
            className={
              "rounded px-2 py-1 text-xs font-semibold " +
              (STATUS_PILL[q.status] ?? "bg-navy/5 text-navy/60")
            }
          >
            {q.status}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left column: map + scope + property */}
        <div className="space-y-4 lg:col-span-2">
          <QuoteDetailMap geometry={geometry} centerLat={lat} centerLng={lng} />

          <ScopeList title="Property" pairs={propertyPairs} />
          <ScopeList title="Scope" pairs={scopePairs} />
        </div>

        {/* Right column: pricing + margin + customer + lifecycle */}
        <div className="space-y-4">
          <section className="rounded-lg border border-navy/10 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-navy/70">
              Pricing
            </h2>
            <dl className="mt-3 divide-y divide-navy/5">
              <PriceRow label="Final price" cents={q.selectedTierCents} bold />
              <PriceRow label="Subtotal (legacy)" cents={q.subtotalCents} />
              <PriceRow label="Deposit" cents={q.depositCents} />
              <PriceRow label="Monthly est." cents={q.monthly24moCents} />
            </dl>
          </section>

          <MarginPanel
            materialCostCents={q.estimatedMaterialCostCents}
            subLaborCostCents={q.estimatedSubCostCents}
            grossMarginPct={q.estimatedGrossMarginPct}
            marginFlag={q.marginFlag}
            selectedTierCents={q.selectedTierCents}
          />

          <ScopeList title="Customer" pairs={customerPairs} />
          <ScopeList title="Lifecycle" pairs={lifecyclePairs} />
        </div>
      </div>
    </div>
  );
}

function PriceRow({
  label,
  cents,
  highlight = false,
  bold = false,
}: {
  label: string;
  cents: number | null;
  highlight?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={
        "flex items-baseline justify-between py-2 text-sm first:pt-0 last:pb-0 " +
        (highlight ? "text-accent" : "text-navy")
      }
    >
      <dt className={highlight ? "font-semibold" : "text-navy/60"}>{label}</dt>
      <dd
        className={
          "tabular-nums " + (bold || highlight ? "font-bold" : "font-medium")
        }
      >
        {cents != null ? formatCents(cents) : "—"}
      </dd>
    </div>
  );
}
