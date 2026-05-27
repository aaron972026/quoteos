"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, X } from "lucide-react";
import type {
  Feature,
  LineString,
  MultiPolygon,
  Polygon,
} from "geojson";
import { Header } from "@/components/brand/Header";
import { Progress } from "@/components/brand/Progress";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { Footer } from "@/components/brand/Footer";
import { SatellitePreview } from "@/components/brand/SatellitePreview";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-locale";
import { cn } from "@/lib/utils";

type Ownership = "owner" | "consent" | null;

interface QuoteShape {
  id: string;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: string | number | null;
  lng: string | number | null;
  ownership: Ownership;
  parcelBoundary:
    | Feature<LineString | Polygon | MultiPolygon>
    | LineString
    | Polygon
    | MultiPolygon
    | null;
}

function ConfirmPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("q");
  const t = useT();

  const [quote, setQuote] = useState<QuoteShape | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<"yes" | "no" | null>(null);
  const [ownership, setOwnership] = useState<Ownership>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!quoteId) {
      setLoadError(t.addressConfirm.notFound);
      return;
    }
    let cancelled = false;
    fetch(`/api/v1/quotes/${quoteId}`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Could not load quote (${r.status})`);
        return r.json();
      })
      .then((q: QuoteShape) => {
        if (cancelled) return;
        setQuote(q);
        if (q.ownership) setOwnership(q.ownership);
        if (q.ownership) setConfirmed("yes");
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : t.addressConfirm.notFound);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [quoteId, t.addressConfirm.notFound]);

  const canContinue = confirmed === "yes" && !!ownership;

  function handleContinue() {
    if (!quoteId || !canContinue || !ownership) return;
    setSaveError(null);
    startTransition(async () => {
      try {
        const r = await fetch(`/api/v1/quotes/${quoteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ownership }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? t.addressConfirm.cantSave);
        }
        router.push(`/draw?q=${quoteId}`);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : t.addressConfirm.cantSave);
      }
    });
  }

  if (loadError) {
    return (
      <div className="flex min-h-dvh flex-col bg-paper">
        <Header />
        <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="font-body text-[16px] text-char">{loadError}</p>
          <Link
            href="/address"
            className="mt-6 font-display text-[13px] font-semibold uppercase tracking-eyebrow text-brick underline-offset-4 hover:underline"
          >
            {t.addressConfirm.backLink}
          </Link>
        </main>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex min-h-dvh flex-col bg-paper">
        <Header />
        <Progress step={1} />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="animate-spin text-navy/40" size={32} />
        </main>
      </div>
    );
  }

  const lat = quote.lat != null ? Number(quote.lat) : null;
  const lng = quote.lng != null ? Number(quote.lng) : null;
  const fullAddress = [quote.addressLine, quote.city, quote.state, quote.zip]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <Header />
      <Progress step={1} />

      <section className="flex-1">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-10 md:px-10 md:py-14 lg:grid-cols-[1.15fr_1fr]">
          {/* Left — satellite */}
          <div className="order-2 lg:order-1">
            {lat != null && lng != null ? (
              <SatellitePreview
                lat={lat}
                lng={lng}
                address={fullAddress}
                labels={{
                  attribution: t.addressConfirm.mapAttribution,
                  scale: t.addressConfirm.scaleLabel,
                  compass: t.addressConfirm.compassN,
                }}
                parcelBoundary={quote.parcelBoundary}
              />
            ) : (
              <div className="flex aspect-[5/4] items-center justify-center rounded-md border border-navy/15 bg-navy/5 font-mono text-[11px] uppercase tracking-spec text-steel">
                Quote missing coordinates
              </div>
            )}
          </div>

          {/* Right — confirm + ownership */}
          <div className="order-1 lg:order-2">
            <Eyebrow>{t.addressConfirm.eyebrow}</Eyebrow>
            <h2 className="mt-4 font-display text-[36px] font-bold uppercase leading-[1] tracking-[0.01em] text-navy md:text-[44px]">
              {t.addressConfirm.title}
            </h2>
            <p className="mt-4 max-w-[44ch] font-body text-[16px] leading-relaxed text-char">
              {t.addressConfirm.lead}
            </p>

            {/* Yes / No buttons */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmed("yes")}
                className={cn(
                  "flex h-14 items-center justify-center gap-2 rounded-sm border font-display text-[13px] font-semibold uppercase tracking-eyebrow transition-all",
                  confirmed === "yes"
                    ? "border-navy bg-navy text-cream"
                    : "border-navy/25 bg-paper text-navy hover:border-navy"
                )}
                aria-pressed={confirmed === "yes"}
              >
                <Check size={16} strokeWidth={2.5} />
                {t.addressConfirm.yesCta}
              </button>
              <Link
                href="/address"
                onClick={() => setConfirmed("no")}
                className={cn(
                  "flex h-14 items-center justify-center gap-2 rounded-sm border font-display text-[13px] font-semibold uppercase tracking-eyebrow transition-all",
                  confirmed === "no"
                    ? "border-brick bg-paper text-brick"
                    : "border-navy/25 bg-paper text-navy hover:border-navy"
                )}
              >
                <X size={16} strokeWidth={2.5} />
                {t.addressConfirm.noCta}
              </Link>
            </div>

            {/* Ownership gate */}
            <div
              className={cn(
                "mt-8 transition-opacity",
                confirmed === "yes"
                  ? "opacity-100"
                  : "pointer-events-none opacity-50"
              )}
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="font-mono text-[11px] uppercase tracking-spec text-brick">
                  {t.addressConfirm.requiredLabel}
                </span>
                <span className="h-px flex-1 bg-navy/15" />
              </div>
              <div className="font-display text-[18px] font-bold uppercase tracking-eyebrow text-navy">
                {t.addressConfirm.ownershipTitle}
              </div>
              <p className="mt-2 font-body text-[14px] leading-relaxed text-char">
                {t.addressConfirm.ownershipLead}
              </p>

              <div className="mt-4 space-y-2.5">
                {(
                  [
                    {
                      value: "owner",
                      title: t.addressConfirm.ownershipOwner,
                      sub: t.addressConfirm.ownershipOwnerSub,
                    },
                    {
                      value: "consent",
                      title: t.addressConfirm.ownershipConsent,
                      sub: t.addressConfirm.ownershipConsentSub,
                    },
                  ] as const
                ).map((opt) => {
                  const checked = ownership === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-sm border p-4 transition-all",
                        checked
                          ? "border-navy bg-cream ring-2 ring-brass/40"
                          : "border-navy/20 bg-paper hover:border-navy/50"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-pill border-2",
                          checked ? "border-brick" : "border-steel-soft"
                        )}
                      >
                        {checked && (
                          <span className="h-2.5 w-2.5 rounded-pill bg-brick" />
                        )}
                      </span>
                      <input
                        type="radio"
                        name="ownership"
                        value={opt.value}
                        className="sr-only"
                        checked={checked}
                        onChange={() => setOwnership(opt.value)}
                      />
                      <div>
                        <div className="font-display text-[13px] font-semibold uppercase tracking-eyebrow text-navy">
                          {opt.title}
                        </div>
                        <div className="mt-1 font-body text-[13px] text-steel">
                          {opt.sub}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {saveError && (
              <div className="mt-4 rounded-sm border border-brick/30 bg-brick/5 px-3 py-2 text-sm text-brick">
                {saveError}
              </div>
            )}

            <div className="mt-8 flex items-center justify-between gap-4">
              <Link
                href="/address"
                className="flex items-center gap-2 font-display text-[13px] font-semibold uppercase tracking-eyebrow text-steel hover:text-navy"
              >
                <ArrowLeft size={14} strokeWidth={2.5} />
                {t.addressConfirm.backLink}
              </Link>
              <Button
                type="button"
                variant="display"
                size="lg"
                disabled={!canContinue || isPending}
                onClick={handleContinue}
              >
                {isPending ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <>
                    {t.addressConfirm.continueCta}
                    <ArrowRight size={14} strokeWidth={2.5} />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmPageInner />
    </Suspense>
  );
}
