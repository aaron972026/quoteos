"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { formatCents } from "@/lib/utils";

interface Props {
  /** Tier total in cents — the principal Wisetack would finance. */
  tierTotalCents: number | null;
  /** Pre-computed monthly payment (24mo @ 9.99%) from the pricing engine. */
  monthly24moCents: number | null;
  /** Quote id, used as the external_id query param so Wisetack can echo it back. */
  quoteId: string;
}

/**
 * Public-facing Wisetack pre-qualification section.
 *
 * For real production integration the merchant configures:
 *   NEXT_PUBLIC_WISETACK_MERCHANT_ID — required to actually link out
 *   NEXT_PUBLIC_WISETACK_CHECKOUT_URL — base URL of the hosted
 *     pre-qual page (defaults to app.wisetack.com/prequalify)
 *
 * Without those env vars, the widget renders the value-prop copy + a
 * "configure to enable" disabled CTA. Same code path, no surprises.
 */
export function WisetackWidget({
  tierTotalCents,
  monthly24moCents,
  quoteId,
}: Props) {
  const merchantId = process.env.NEXT_PUBLIC_WISETACK_MERCHANT_ID;
  const baseUrl =
    process.env.NEXT_PUBLIC_WISETACK_CHECKOUT_URL ??
    "https://app.wisetack.com/prequalify";

  const configured = !!merchantId;

  let prequalUrl: string | null = null;
  if (configured && tierTotalCents != null) {
    const params = new URLSearchParams({
      merchantId: merchantId!,
      amount: String(tierTotalCents), // Wisetack wants cents
      external_id: quoteId,
      return_url:
        typeof window !== "undefined"
          ? `${window.location.origin}/quote/${quoteId}?wt=return`
          : `/quote/${quoteId}?wt=return`,
    });
    prequalUrl = `${baseUrl}?${params.toString()}`;
  }

  return (
    <div className="rounded-xl border border-navy/10 bg-gradient-to-br from-white to-accent/5 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <ShieldCheck size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-navy">
            Spread it out with Wisetack
          </div>
          <div className="text-xs text-navy/60">
            Soft credit pull — no impact to your score. Pre-qualify in 30 seconds.
          </div>
        </div>
      </div>

      {monthly24moCents != null && monthly24moCents > 0 && (
        <div className="mt-4 rounded-lg border border-accent/30 bg-white px-3 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-navy/50">
            Estimated payment
          </div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums text-navy">
              {formatCents(monthly24moCents)}
            </span>
            <span className="text-sm text-navy/60">/mo · 24 months</span>
          </div>
          <div className="mt-1 text-[11px] text-navy/50">
            Final terms set by Wisetack at pre-qualification. APR varies by
            credit profile.
          </div>
        </div>
      )}

      {configured && prequalUrl ? (
        <Link
          href={prequalUrl}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-navy py-3 text-sm font-semibold text-white hover:bg-navy-600"
        >
          Pre-qualify with Wisetack <ArrowRight size={16} />
        </Link>
      ) : (
        <div className="mt-4">
          <button
            type="button"
            disabled
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-navy/30 py-3 text-sm font-semibold text-white"
          >
            Pre-qualify with Wisetack
          </button>
          <p className="mt-2 text-[11px] italic text-navy/50">
            Wisetack not yet configured — set{" "}
            <code className="rounded bg-navy/5 px-1 font-mono">
              NEXT_PUBLIC_WISETACK_MERCHANT_ID
            </code>{" "}
            in .env.local to enable.
          </p>
        </div>
      )}

      <div className="mt-3 text-center">
        <Link
          href="https://www.wisetack.com/how-it-works"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-navy/50 underline-offset-4 hover:text-navy hover:underline"
        >
          How financing works →
        </Link>
      </div>
    </div>
  );
}
