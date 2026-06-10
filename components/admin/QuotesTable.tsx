import Link from "next/link";
import { formatCents } from "@/lib/utils";

type MarginFlag = "ok" | "warn" | "low" | null;

export interface QuoteRow {
  id: string;
  quoteNumber: string | null;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  addressLine: string | null;
  city: string | null;
  zip: string | null;
  linearFeet: string | number | null;
  skuCode: string | null;
  selectedTierCents: number | null;
  subtotalCents: number | null;
  marginFlag: MarginFlag;
  createdAt: Date | string;
}

interface Props {
  rows: QuoteRow[];
}

const STATUS_PILL: Record<string, string> = {
  draft: "bg-navy/10 text-navy/70",
  finalized: "bg-amber-100 text-amber-900",
  deposit_paid: "bg-green-100 text-green-900",
  won: "bg-emerald-100 text-emerald-900",
  lost: "bg-red-50 text-red-900",
  expired: "bg-navy/5 text-navy/40",
  refunded: "bg-purple-50 text-purple-900",
};

const MARGIN_PILL: Record<NonNullable<MarginFlag>, string> = {
  ok: "bg-emerald-50 text-emerald-800",
  warn: "bg-amber-50 text-amber-800",
  low: "bg-red-50 text-red-800",
};

function relativeTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const ms = Date.now() - date.getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

export function QuotesTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-navy/10 bg-white p-12 text-center text-sm text-navy/60">
        No quotes match these filters.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-navy/10 bg-navy/[0.02] text-left text-xs uppercase tracking-wider text-navy/60">
            <tr>
              <th className="px-4 py-2.5">Quote</th>
              <th className="px-4 py-2.5">Address</th>
              <th className="px-4 py-2.5">SKU</th>
              <th className="px-4 py-2.5 text-right">LF</th>
              <th className="px-4 py-2.5 text-right">Price</th>
              <th className="px-4 py-2.5">Margin</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/5">
            {rows.map((r) => {
              const price = r.selectedTierCents ?? r.subtotalCents;
              return (
                <tr key={r.id} className="hover:bg-navy/[0.02]">
                  <td className="px-4 py-2.5 font-mono text-xs text-navy/80">
                    <Link
                      href={`/admin/quotes/${r.id}`}
                      className="hover:text-accent hover:underline"
                    >
                      {r.quoteNumber ?? r.id.slice(0, 8)}
                    </Link>
                    {r.customerEmail && (
                      <div className="mt-0.5 truncate text-[10px] text-navy/40">
                        {r.customerEmail}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="truncate text-navy">{r.addressLine ?? "—"}</div>
                    <div className="truncate text-[11px] text-navy/50">
                      {[r.city, r.zip].filter(Boolean).join(", ")}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-navy/70">
                    {r.skuCode ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-navy/80">
                    {r.linearFeet != null ? Number(r.linearFeet).toFixed(0) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-navy">
                    {price != null ? formatCents(price) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.marginFlag ? (
                      <span
                        className={
                          "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase " +
                          MARGIN_PILL[r.marginFlag]
                        }
                      >
                        {r.marginFlag}
                      </span>
                    ) : (
                      <span className="text-navy/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        "inline-block rounded px-2 py-0.5 text-[10px] font-semibold " +
                        (STATUS_PILL[r.status] ?? "bg-navy/5 text-navy/60")
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-navy/60">
                    {relativeTime(r.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
