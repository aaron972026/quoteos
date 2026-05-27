"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { cn, formatCents } from "@/lib/utils";

interface Props {
  monthly24moCents: number | null;
}

export function WisetackWidget({ monthly24moCents }: Props) {
  const prequalBase = process.env.NEXT_PUBLIC_WISETACK_PREQUAL_URL;
  const configured = !!prequalBase && /^https?:\/\//i.test(prequalBase);
  const prequalUrl = configured ? prequalBase! : null;

  return (
    <div className="rounded-sm border border-navy/15 bg-cream-deep p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-pill border-2 border-brass bg-paper text-brass">
          <ShieldCheck size={18} strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-spec text-brick">
            Financing
          </div>
          <div className="mt-1 font-display text-[18px] font-bold uppercase leading-[1.1] tracking-[0.04em] text-navy">
            Spread It Out With Wisetack
          </div>
          <p className="mt-1.5 font-body text-[12.5px] leading-[1.5] text-steel">
            Soft credit pull — no impact to your score. Pre-qualify in 30 seconds.
          </p>
        </div>
      </div>

      {monthly24moCents != null && monthly24moCents > 0 && (
        <div className="mt-5 rounded-sm border border-navy/15 bg-paper px-4 py-4">
          <div className="font-mono text-[10px] uppercase tracking-spec text-steel">
            Estimated Payment
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-[28px] font-bold leading-none tabular-nums text-navy">
              {formatCents(monthly24moCents)}
            </span>
            <span className="font-body text-[13px] text-steel">
              / mo · 24 months
            </span>
          </div>
          <p className="mt-2 font-body text-[11px] leading-[1.45] text-steel-soft">
            Final terms set by Wisetack at pre-qualification. APR varies by
            credit profile.
          </p>
        </div>
      )}

      {configured && prequalUrl ? (
        // Plain <a> — Wisetack URLs are hash-based SPA routes.
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a
          href={prequalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-navy px-6",
            "font-display text-[13px] font-semibold uppercase tracking-eyebrow text-cream",
            "transition-colors hover:bg-navy-soft"
          )}
        >
          Pre-Qualify With Wisetack
          <ArrowRight size={14} strokeWidth={2.5} />
        </a>
      ) : (
        <div className="mt-5">
          <button
            type="button"
            disabled
            className="flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-steel-soft px-6 font-display text-[13px] font-semibold uppercase tracking-eyebrow text-cream"
          >
            Pre-Qualify With Wisetack
          </button>
          <p className="mt-2 font-body text-[11px] italic leading-[1.4] text-steel">
            Wisetack not yet configured — set{" "}
            <code className="rounded-sm bg-navy/5 px-1 font-mono text-[10px] text-navy">
              NEXT_PUBLIC_WISETACK_PREQUAL_URL
            </code>{" "}
            in .env.local.
          </p>
        </div>
      )}

      <div className="mt-4 text-center">
        <Link
          href="https://www.wisetack.com/how-it-works"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] uppercase tracking-spec text-steel underline-offset-4 hover:text-navy hover:underline"
        >
          How Financing Works →
        </Link>
      </div>
    </div>
  );
}
