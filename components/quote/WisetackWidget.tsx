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
 * Configuration: NEXT_PUBLIC_WISETACK_PREQUAL_URL — the merchant-specific
 * pre-qualify link Wisetack provides during onboarding. Looks like:
 *   https://app.wisetack.com/financing/prequalify/<your-slug>
 *
 * Some merchant pages also accept `amount` and `external_id` query params;
 * we append them defensively (Wisetack ignores unknown params if not
 * supported on that page). The return_url is built client-side so it
 * picks up the actual deployment hostname.
 *
 * The legacy NEXT_PUBLIC_WISETACK_MERCHANT_ID env is no longer required;
 * the URL alone is sufficient because Wisetack's prequal links already
 * encode merchant context.
 */
export function WisetackWidget({
  tierTotalCents,
  monthly24moCents,
  quoteId,
}: Props) {
  const prequalBase = process.env.NEXT_PUBLIC_WISETACK_PREQUAL_URL;
  const configured = !!prequalBase && /^https?:\/\//i.test(prequalBase);

  let prequalUrl: string | null = null;
  if (configured && prequalBase) {
    const sep = prequalBase.includes("?") ? "&" : "?";
    const extras = new URLSearchParams({
      external_id: quoteId,
    });
    if (tierTotalCents != null) {
      extras.set("amount", String(tierTotalCents));
    }
    if (typeof window !== "undefined") {
      extras.set("return_url", `${window.location.origin}/quote/${quoteId}?wt=return`);
    }
    prequalUrl = `${prequalBase}${sep}${extras.toString()}`;
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
          target="_blank"
          rel="noopener noreferrer"
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
              NEXT_PUBLIC_WISETACK_PREQUAL_URL
            </code>{" "}
            in .env.local to your Wisetack-provided pre-qualify link.
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
