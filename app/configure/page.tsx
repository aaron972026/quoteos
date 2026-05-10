"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressDots } from "@/components/ProgressDots";
import { FamilyCard } from "@/components/configure/FamilyCard";
import { TierCard } from "@/components/configure/TierCard";
import { AddonRow } from "@/components/configure/AddonRow";
import { formatCents } from "@/lib/utils";

interface SkuApiRow {
  code: string;
  family: string;
  familyName: string;
  tier: "good" | "better" | "best";
  description: string;
  heightInches: number;
  basePricePerLfCents: number;
  heroImageUrl: string | null;
  specBullets: string[];
  sortOrder: number;
}

interface QuoteShape {
  id: string;
  linearFeet: string | number | null;
  cornerCount: number | null;
  slopeCode: number | null;
  demoType: "NONE" | "CEDAR" | "CHAIN" | "METAL" | "CONC" | null;
  demoRequired: boolean | null;
  addressLine: string | null;
}

interface PricingResponse {
  subtotal_cents: number;
  tiers: {
    good: { total_cents: number; monthly_24mo_cents: number };
    better: { total_cents: number; monthly_24mo_cents: number };
    best: { total_cents: number; monthly_24mo_cents: number };
  };
  deposit_cents: number;
  warnings: string[];
}

const HEIGHT_UPGRADE_FAMILIES = new Set(["CP", "HC"]);
type Tier = "good" | "better" | "best";

function ConfigurePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("q");

  const [skus, setSkus] = useState<SkuApiRow[] | null>(null);
  const [quote, setQuote] = useState<QuoteShape | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [family, setFamily] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>("better"); // default Better per spec §6
  const [heightUpgrade, setHeightUpgrade] = useState(false);
  const [frenchGothic, setFrenchGothic] = useState(false);
  const [stainSeal, setStainSeal] = useState(false);

  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // ── Initial data load ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/v1/skus", { credentials: "include" }).then((r) => r.json()),
      quoteId
        ? fetch(`/api/v1/quotes/${quoteId}`, { credentials: "include" }).then(
            async (r) => {
              if (!r.ok) throw new Error(`Quote load failed (${r.status})`);
              return r.json();
            }
          )
        : Promise.reject(new Error("Missing quote id")),
    ])
      .then(([s, q]) => {
        if (cancelled) return;
        setSkus(s);
        setQuote(q);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      });
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  // Reset incompatible options when switching family
  useEffect(() => {
    if (family && !HEIGHT_UPGRADE_FAMILIES.has(family) && heightUpgrade) {
      setHeightUpgrade(false);
    }
  }, [family, heightUpgrade]);

  // ── Family list (one card per family, "starting at" = good-tier price) ───
  const families = useMemo(() => {
    if (!skus) return [];
    type FamilyRow = {
      code: string;
      familyName: string;
      startingAtCents: number;
      description: string;
    };
    const byFamily = new Map<string, FamilyRow>();
    for (const sku of skus) {
      if (sku.tier === "good") {
        byFamily.set(sku.family, {
          code: sku.family,
          familyName: sku.familyName,
          startingAtCents: sku.basePricePerLfCents,
          description: sku.description,
        });
      }
    }
    return Array.from(byFamily.values()).sort(
      (a, b) => a.startingAtCents - b.startingAtCents
    );
  }, [skus]);

  // ── Tier cards for the picked family ─────────────────────────────
  const familyTiers = useMemo(() => {
    if (!skus || !family) return null;
    const ofFamily = skus.filter((s) => s.family === family);
    return {
      good: ofFamily.find((s) => s.tier === "good"),
      better: ofFamily.find((s) => s.tier === "better"),
      best: ofFamily.find((s) => s.tier === "best"),
    };
  }, [skus, family]);

  // ── Live debounced pricing ───────────────────────────────────────
  useEffect(() => {
    if (!family || !quote || !quote.linearFeet) return;
    const skuCode = `${family}-${
      tier === "good" ? "G" : tier === "better" ? "B" : "X"
    }`;
    const ctl = new AbortController();
    setPricingLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await fetch("/api/v1/pricing/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: ctl.signal,
          body: JSON.stringify({
            sku_code: skuCode,
            linear_feet: Number(quote.linearFeet),
            corner_count: quote.cornerCount ?? 0,
            slope_code: quote.slopeCode ?? 0,
            demo_type: quote.demoType ?? "NONE",
            gates: [], // Phase 1 follow-up
            height_upgrade: heightUpgrade,
            french_gothic: frenchGothic,
            stain_seal: stainSeal,
          }),
        });
        if (!r.ok) throw new Error("pricing failed");
        const json = (await r.json()) as PricingResponse;
        setPricing(json);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          console.error(e);
        }
      } finally {
        setPricingLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [family, tier, heightUpgrade, frenchGothic, stainSeal, quote]);

  // ── Continue → save selection + route to Screen 5 ────────────────
  function handleContinue() {
    if (!quoteId || !family) return;
    const skuCode = `${family}-${
      tier === "good" ? "G" : tier === "better" ? "B" : "X"
    }`;
    setError(null);
    startTransition(async () => {
      try {
        const r = await fetch(`/api/v1/quotes/${quoteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            sku_code: skuCode,
            tier,
            height_upgrade: heightUpgrade,
            french_gothic: frenchGothic,
            stain_seal: stainSeal,
          }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? "Could not save");
        }
        router.push(`/quote/${quoteId}`);
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

  if (!quote || !skus) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-6">
        <Loader2 className="animate-spin text-navy/40" size={32} />
        <p className="mt-3 text-sm text-navy/60">Loading…</p>
      </main>
    );
  }

  const lf = Number(quote.linearFeet) || 0;
  const heightUpgradeAvailable = family ? HEIGHT_UPGRADE_FAMILIES.has(family) : false;
  const livePrice =
    pricing?.tiers?.[tier]?.total_cents ?? null;

  return (
    <div className="flex min-h-dvh flex-col bg-white pb-24">
      <header className="border-b border-navy/10 bg-white px-4 py-2">
        <ProgressDots current="configure" />
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/draw?q=${quoteId}`}
            className="inline-flex items-center gap-1 text-sm text-navy/60 hover:text-navy"
          >
            <ArrowLeft size={16} /> Back to drawing
          </Link>
          <div className="text-sm text-navy/60">
            <span className="font-semibold text-navy">{lf.toFixed(0)}</span> LF
          </div>
        </div>

        {/* ─── Step A: pick a family ────────────────────────────── */}
        {!family && (
          <section>
            <h1 className="text-2xl font-bold text-navy sm:text-3xl">
              Pick your fence style
            </h1>
            <p className="mt-1 text-sm text-navy/60">
              Five options. Sorted by price.
            </p>
            <div className="mt-5 space-y-2.5">
              {families.map((f) => (
                <FamilyCard
                  key={f.code}
                  family={f.code}
                  familyName={f.familyName}
                  startingAtCents={f.startingAtCents}
                  description={f.description}
                  selected={false}
                  onSelect={() => setFamily(f.code)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ─── Step B: pick tier + add-ons ────────────────────────── */}
        {family && familyTiers && (
          <section>
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFamily(null)}
                className="rounded-full border border-navy/15 px-3 py-1 text-xs font-semibold text-navy/70 hover:border-navy/30"
              >
                ← Change style
              </button>
              <span className="text-sm font-semibold text-navy">
                {familyTiers.better?.familyName ?? family}
              </span>
            </div>

            <h2 className="text-xl font-bold text-navy">Pick your level</h2>
            <div
              role="radiogroup"
              aria-label="Tier selection"
              className="mt-4 space-y-3"
            >
              {(["good", "better", "best"] as const).map((t) => {
                const sku = familyTiers[t];
                if (!sku) return null;
                return (
                  <TierCard
                    key={t}
                    tier={t}
                    description={sku.description}
                    pricePerLfCents={sku.basePricePerLfCents}
                    specBullets={sku.specBullets}
                    selected={tier === t}
                    onSelect={() => setTier(t)}
                  />
                );
              })}
            </div>

            <h2 className="mt-8 text-xl font-bold text-navy">Add-ons</h2>
            <div className="mt-3 space-y-2.5">
              <AddonRow
                label="Stain & seal"
                description="UV / weather protection. Doubles the life of cedar."
                priceLabel="+$3.25/LF"
                checked={stainSeal}
                onChange={setStainSeal}
              />
              <AddonRow
                label="Height upgrade — 8' tall"
                description="Bumps standard 6' fence up to 8'."
                priceLabel="+18%"
                checked={heightUpgrade}
                disabled={!heightUpgradeAvailable}
                disabledReason="Available on Cedar Privacy and Horizontal Cedar only"
                onChange={setHeightUpgrade}
              />
              <AddonRow
                label="French Gothic top"
                description="Premium decorative picket profile."
                priceLabel="+$2.00/LF"
                checked={frenchGothic}
                onChange={setFrenchGothic}
              />
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                {error}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ─── Sticky live-price bar ──────────────────────────────── */}
      {family && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-navy/10 bg-white px-4 py-3 shadow-[0_-2px_12px_rgba(31,58,95,0.08)] sm:px-6">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="flex-1">
              <div className="text-xs text-navy/60">Estimated price</div>
              <div className="flex items-baseline gap-2">
                <div className="text-xl font-bold tabular-nums text-navy">
                  {livePrice ? formatCents(livePrice) : "—"}
                </div>
                {pricingLoading && (
                  <Loader2 size={14} className="animate-spin text-navy/40" />
                )}
              </div>
            </div>
            <Button
              type="button"
              size="lg"
              onClick={handleContinue}
              disabled={!family || isPending}
              className="flex-shrink-0"
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" size={20} /> Saving…
                </>
              ) : (
                <>
                  See my final price <ArrowRight size={18} />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConfigurePage() {
  return (
    <Suspense fallback={null}>
      <ConfigurePageInner />
    </Suspense>
  );
}
