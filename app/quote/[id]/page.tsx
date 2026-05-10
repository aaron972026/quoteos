"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Loader2,
  Lock,
  Mail,
  Phone,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressDots } from "@/components/ProgressDots";
import { TierComparison } from "@/components/quote/TierComparison";
import { ScopeSummary } from "@/components/quote/ScopeSummary";
import { QuoteCountdown } from "@/components/quote/QuoteCountdown";
import { TrustStrip } from "@/components/TrustStrip";

type Tier = "good" | "better" | "best";

interface QuoteShape {
  id: string;
  status: string;
  addressLine: string | null;
  zip: string | null;
  linearFeet: string | number | null;
  cornerCount: number | null;
  slopeCode: number | null;
  demoType: "NONE" | "CEDAR" | "CHAIN" | "METAL" | "CONC" | null;
  demoRequired: boolean | null;
  skuCode: string | null;
  tier: Tier | null;
  heightUpgrade: boolean | null;
  frenchGothic: boolean | null;
  stainSeal: boolean | null;
  priceValidUntil: string | null;
}

interface PricingResponse {
  subtotal_cents: number;
  tiers: {
    good: { total_cents: number; monthly_24mo_cents: number };
    better: { total_cents: number; monthly_24mo_cents: number };
    best: { total_cents: number; monthly_24mo_cents: number };
  };
  deposit_cents: number;
  valid_until: string;
  breakdown: {
    base_fence: number;
    height_upgrade: number;
    french_gothic: number;
    stain: number;
    demo: number;
    corners: number;
    gates: number;
    permit: number;
    hoa_admin: number;
    travel: number;
  };
  warnings: string[];
}

interface SkuRow {
  code: string;
  family: string;
  familyName: string;
}

export default function QuotePage({ params }: { params: { id: string } }) {
  const [quote, setQuote] = useState<QuoteShape | null>(null);
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [skuMeta, setSkuMeta] = useState<SkuRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>("better");
  const [isLocking, startLockIn] = useTransition();

  // ── Initial data load ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/quotes/${params.id}`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Quote load failed (${r.status})`);
        return r.json();
      })
      .then(async (q: QuoteShape) => {
        if (cancelled) return;
        setQuote(q);
        setTier(q.tier ?? "better");
        if (!q.skuCode) throw new Error("Quote is missing a SKU");

        // Re-call pricing to get fresh 3-tier comparison + breakdown
        const priceR = await fetch("/api/v1/pricing/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            sku_code: q.skuCode,
            linear_feet: Number(q.linearFeet ?? 0),
            corner_count: q.cornerCount ?? 0,
            slope_code: q.slopeCode ?? 0,
            demo_type: q.demoType ?? "NONE",
            gates: [],
            height_upgrade: !!q.heightUpgrade,
            french_gothic: !!q.frenchGothic,
            stain_seal: !!q.stainSeal,
          }),
        });
        if (!priceR.ok) throw new Error("Pricing failed");
        const p = (await priceR.json()) as PricingResponse;
        if (!cancelled) setPricing(p);

        // Pull SKU meta to render the family name
        const skusR = await fetch("/api/v1/skus", { credentials: "include" });
        const skus = (await skusR.json()) as SkuRow[];
        const sku = skus.find((s) => s.code === q.skuCode) ?? null;
        if (!cancelled) setSkuMeta(sku);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  function handleSelectTier(t: Tier) {
    setTier(t);
    // fire-and-forget save — the lock-in will re-set this anyway
    fetch(`/api/v1/quotes/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ tier: t }),
    }).catch(() => {});
  }

  function handleLockIn() {
    setError(null);
    startLockIn(async () => {
      try {
        const r = await fetch(`/api/v1/quotes/${params.id}/lock-in`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tier }),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (r.status === 503) {
            throw new Error(
              "Stripe isn't configured yet. Add STRIPE_SECRET_KEY to .env.local and restart the dev server."
            );
          }
          throw new Error(body?.error?.message ?? "Could not start checkout");
        }
        if (body.checkout_url) {
          window.location.href = body.checkout_url;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  if (error && !quote) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-6">
        <TriangleAlert size={32} className="text-accent" />
        <h1 className="mt-3 text-xl font-semibold text-navy">{error}</h1>
        <Link href="/" className="mt-6 text-sm underline">
          Start over
        </Link>
      </main>
    );
  }

  if (!quote || !pricing) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-6">
        <Loader2 className="animate-spin text-navy/40" size={32} />
        <p className="mt-3 text-sm text-navy/60">Loading your quote…</p>
      </main>
    );
  }

  const lf = Number(quote.linearFeet ?? 0);
  const familyName = skuMeta?.familyName ?? "Fence";

  return (
    <div className="flex min-h-dvh flex-col bg-white pb-16">
      <header className="border-b border-navy/10 bg-white px-4 py-2">
        <ProgressDots current="quote" />
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/configure?q=${params.id}`}
            className="inline-flex items-center gap-1 text-sm text-navy/60 hover:text-navy"
          >
            <ArrowLeft size={16} /> Edit options
          </Link>
          <QuoteCountdown validUntil={pricing.valid_until} />
        </div>

        <h1 className="text-2xl font-bold text-navy sm:text-3xl">
          Your fence quote
        </h1>
        <p className="mt-1 text-sm text-navy/60">
          {lf.toFixed(0)} LF {familyName} · {quote.addressLine}
        </p>

        <div className="mt-5">
          <TierComparison
            tiers={pricing.tiers}
            selected={tier}
            onSelect={handleSelectTier}
          />
        </div>

        <div className="mt-6">
          <ScopeSummary
            linearFeet={lf}
            cornerCount={quote.cornerCount ?? 0}
            familyName={familyName}
            tier={tier}
            demoRequired={!!quote.demoRequired}
            heightUpgrade={!!quote.heightUpgrade}
            frenchGothic={!!quote.frenchGothic}
            stainSeal={!!quote.stainSeal}
            breakdown={pricing.breakdown}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy/60">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock size={14} className="text-accent" />
            Installed in 10–17 days from deposit
          </span>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-3">
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={handleLockIn}
            disabled={isLocking}
          >
            {isLocking ? (
              <>
                <Loader2 className="animate-spin" size={20} /> Starting checkout…
              </>
            ) : (
              <>
                <Lock size={18} /> Lock in my price — $99 (refundable)
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled
            title="Email PDF — coming next"
          >
            <Mail size={18} /> Email me this quote
          </Button>

          <a
            href="tel:+19185550100"
            className="flex w-full items-center justify-center gap-2 py-2 text-sm text-navy/60 hover:text-navy"
          >
            <Phone size={14} /> Want to talk first? Call (918) 555-0100
          </a>
        </div>

        <div className="mt-8 rounded-lg border border-navy/10 bg-navy/5 p-4 text-sm">
          <div className="font-semibold text-navy">
            Spread out payments with Wisetack
          </div>
          <div className="mt-1 text-xs text-navy/60">
            Pre-qualify in 30 seconds. Soft credit pull — no impact to your
            score.
          </div>
          <div className="mt-3 text-xs italic text-navy/50">
            Wisetack widget loads here once configured (WISETACK_MERCHANT_ID).
          </div>
        </div>

        <div className="mt-10 border-t border-navy/10 pt-6">
          <TrustStrip compact />
        </div>
      </main>
    </div>
  );
}
