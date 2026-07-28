"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  Loader2,
  Mail,
  Phone,
  Star,
  TriangleAlert,
} from "lucide-react";
import { Header } from "@/components/brand/Header";
import { Progress } from "@/components/brand/Progress";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { Footer } from "@/components/brand/Footer";
import { StarCoin } from "@/components/brand/StarCoin";
import { PicketLoader } from "@/components/brand/PicketLoader";
import { QuoteCountdown } from "@/components/quote/QuoteCountdown";
import { EmailSheet } from "@/components/quote/EmailSheet";
import { WisetackWidget } from "@/components/quote/WisetackWidget";
import { useT, useLocale } from "@/lib/i18n/use-locale";
import { formatInstallWeek } from "@/lib/scheduling/install-week";
import { BUSINESS, PHONE_HREF } from "@/lib/business";
import { formatCents } from "@/lib/utils";

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
  city: string | null;
  stainSeal: boolean | null;
  steelPostUpgrade: boolean | null;
  capRailTrim: boolean | null;
  matchVinylPosts: boolean | null;
  ironclad: boolean | null;
  boardOnBoard: boolean | null;
  priceValidUntil: string | null;
  commitmentLane: string | null; // 'reserved' | 'price_hold'
  priceHoldExpiresAt: string | null;
  reservedWeekStart: string | null; // 'YYYY-MM-DD'
  gates?: Array<{ type: string; count: number }> | null;
}

interface PricingBreakdown {
  base_fence_cents: number;
  slope_surcharge_cents: number;
  access_surcharge_cents: number;
  steel_upgrade_cents: number;
  ironclad_cents: number;
  board_on_board_cents: number;
  cap_rail_cents: number;
  match_vinyl_posts_cents: number;
  gates_cents: number;
  demo_cents: number;
  stain_cents: number;
  rock_drilling_cents: number;
  tear_concrete_cents: number;
  permit_cents: number;
}

interface PricingResponse {
  final_price_cents: number;
  display_range_low_cents: number;
  display_range_high_cents: number;
  raw_subtotal_cents: number;
  guards_applied: string[];
  deposit_cents: number;
  monthly_24mo_cents: number;
  valid_until: string;
  breakdown: PricingBreakdown;
  warnings: string[];
}

interface SkuRow {
  code: string;
  family: string;
  familyName: string;
  heightInches: number;
}

export default function QuotePage({ params }: { params: { id: string } }) {
  const t = useT();
  const locale = useLocale();
  const [quote, setQuote] = useState<QuoteShape | null>(null);
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [skuMeta, setSkuMeta] = useState<SkuRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLocking, startLockIn] = useTransition();
  const [isHolding, startHold] = useTransition();
  const [emailSheetOpen, setEmailSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/quotes/${params.id}`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${t.quote.loadFailed} (${r.status})`);
        return r.json();
      })
      .then(async (q: QuoteShape) => {
        if (cancelled) return;
        setQuote(q);
        if (!q.skuCode) throw new Error(t.quote.missingSku);

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
            gates: q.gates ?? [],
            stain_seal: !!q.stainSeal,
            ironclad: !!q.ironclad,
            board_on_board: !!q.boardOnBoard,
            steel_post_upgrade: !!q.steelPostUpgrade,
            cap_rail_trim: !!q.capRailTrim,
            match_vinyl_posts: !!q.matchVinylPosts,
            city: q.city ?? "Tulsa",
          }),
        });
        if (!priceR.ok) throw new Error(t.quote.pricingFailed);
        const p = (await priceR.json()) as PricingResponse;
        if (!cancelled) setPricing(p);

        const skusR = await fetch("/api/v1/skus", { credentials: "include" });
        const skus = (await skusR.json()) as SkuRow[];
        const sku = skus.find((s) => s.code === q.skuCode) ?? null;
        if (!cancelled) setSkuMeta(sku);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t.quote.loadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [
    params.id,
    t.quote.loadFailed,
    t.quote.missingSku,
    t.quote.pricingFailed,
  ]);

  function handleLockIn() {
    setError(null);
    startLockIn(async () => {
      try {
        const r = await fetch(`/api/v1/quotes/${params.id}/lock-in`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (r.status === 503) throw new Error(t.quote.stripeNotConfigured);
          throw new Error(body?.error?.message ?? t.quote.checkoutFailed);
        }
        if (body.checkout_url) {
          window.location.href = body.checkout_url;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t.quote.checkoutFailed);
      }
    });
  }

  // Free "hold my price" lane — no payment. Persist the choice, then refetch
  // the quote so the held state (and its server-stored expiry) render.
  function handleHold() {
    setError(null);
    startHold(async () => {
      try {
        const r = await fetch(`/api/v1/quotes/${params.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ commitment_lane: "price_hold" }),
        });
        if (!r.ok) throw new Error(t.commitment.errorGeneric);
        const fresh = await fetch(`/api/v1/quotes/${params.id}`, {
          credentials: "include",
        });
        if (fresh.ok) setQuote((await fresh.json()) as QuoteShape);
      } catch (e) {
        setError(e instanceof Error ? e.message : t.commitment.errorGeneric);
      }
    });
  }

  if (error && !quote) {
    return (
      <div className="flex min-h-dvh flex-col bg-paper">
        <Header />
        <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-6 text-center">
          <TriangleAlert size={32} className="text-brick" />
          <h1 className="mt-3 font-display text-[20px] font-semibold uppercase tracking-eyebrow text-navy">
            {error}
          </h1>
          <Link
            href="/"
            className="mt-6 font-display text-[13px] font-semibold uppercase tracking-eyebrow text-brick underline-offset-4 hover:underline"
          >
            {t.common.startOver}
          </Link>
        </main>
      </div>
    );
  }

  if (!quote || !pricing) {
    return (
      <div className="flex min-h-dvh flex-col bg-paper">
        <Header dark />
        <Progress step={4} dark />
        <main className="flex flex-1 flex-col items-center justify-center gap-4">
          <PicketLoader height={30} label={t.quote.loading} />
          <p className="font-mono text-[11px] uppercase tracking-spec text-steel">
            {t.quote.loading}
          </p>
        </main>
      </div>
    );
  }

  const lf = Number(quote.linearFeet ?? 0);
  const familyName = skuMeta?.familyName ?? "Fence";
  const family = skuMeta?.family ?? "";
  const heightLabel = skuMeta?.heightInches
    ? `${Math.round(skuMeta.heightInches / 12)} FT`
    : null;
  const quoteRef = `FP-${quote.id.slice(0, 8).toUpperCase()}`;

  // Family-aware override for the "Materials" trust-card row so we don't
  // promise "Western Red Cedar" to a Budget Pine or Chain Link customer.
  const materialsRow = (() => {
    if (family === "BP") {
      return {
        title: "KDAT Pine, Hand-Selected",
        body:
          "Kiln-dried after treatment (KDAT) pine, hand-picked for straightness and grain. Backed by our 12-month no-warp guarantee.",
      };
    }
    if (family === "CL") {
      return {
        title: "Galvanized + PVC-Coated Mesh",
        body:
          "Mill-fresh galvanized fabric or 9-gauge PVC-coated mesh — no rust streaks, no surprises at delivery.",
      };
    }
    return t.quote.inclusions[1]; // default cedar-graded row
  })();

  const concreteRow = {
    title: "Concrete-Set Posts, Plumb",
    body:
      "Posts set 32–36″ deep · 160–240 lbs of 3,000-psi concrete per post (Ivory Standard sets deepest, with the most concrete). Plumb and square, checked twice with a 4-foot level.",
  };

  const inclusionsRendered = [
    t.quote.inclusions[0],
    materialsRow,
    concreteRow,
    t.quote.inclusions[3],
    t.quote.inclusions[4],
  ];

  const low = pricing.display_range_low_cents;
  const high = pricing.display_range_high_cents;

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <Header dark />
      <Progress step={4} dark />

      <section className="flex-1">
        <div className="mx-auto max-w-[1280px] px-5 py-8 md:px-10 md:py-12">
          {/* Spec line */}
          <div className="font-mono text-[11px] uppercase tracking-spec text-brick">
            QUOTE #{quoteRef} · {lf.toFixed(0)} LF · {familyName}
            {heightLabel ? ` · ${heightLabel}` : ""}
            {quote.skuCode ? ` · ${quote.skuCode}` : ""}
          </div>

          <div className="mt-6 grid items-start gap-10 lg:grid-cols-[1.1fr_1fr]">
            {/* ── Left column ─────────────────────────────────── */}
            <div>
              <Eyebrow>{t.quote.eyebrow}</Eyebrow>
              <h1 className="mt-3 font-display text-[44px] font-bold uppercase leading-[0.95] tracking-[0.01em] text-navy md:text-[60px]">
                {t.quote.title1}
                <br />
                {t.quote.title2}
              </h1>

              <div className="mt-8 overflow-hidden rounded-sm border border-navy/15 bg-cream shadow-card">
                <div className="h-[3px] w-full bg-brass" />
                <div className="px-7 py-7">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-spec text-steel">
                      {t.quote.rangeLabel}
                    </span>
                    {pricing.valid_until && (
                      <QuoteCountdown
                        validUntil={pricing.valid_until}
                        prefix={t.quote.countdownPrefix}
                        expiredLabel={t.quote.countdownExpired}
                      />
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-baseline gap-3">
                    <span className="font-display text-[56px] font-bold leading-none tabular-nums text-brick md:text-[72px]">
                      {formatCents(low)}
                    </span>
                    <span className="font-display text-[40px] font-bold leading-none text-brick/40 md:text-[56px]">
                      –
                    </span>
                    <span className="font-display text-[56px] font-bold leading-none tabular-nums text-brick md:text-[72px]">
                      {formatCents(high)}
                    </span>
                  </div>

                  <p className="mt-5 max-w-[52ch] font-body text-[14px] leading-[1.55] text-char">
                    {t.quote.rangeHelper}
                  </p>
                </div>
              </div>

              <CommitmentStep
                t={t}
                locale={locale}
                quote={quote}
                reserving={isLocking}
                holding={isHolding}
                onReserve={handleLockIn}
                onHold={handleHold}
              />

              {error && (
                <div className="mt-4 rounded-sm border border-brick/30 bg-brick/5 px-3 py-2 text-sm text-brick">
                  {error}
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setEmailSheetOpen(true)}
                  className="flex h-12 items-center gap-2 rounded-sm border border-navy/30 px-5 font-display text-[13px] font-semibold uppercase tracking-eyebrow text-navy transition-colors hover:border-navy hover:bg-navy/5"
                >
                  <Mail size={14} strokeWidth={2.5} />
                  {t.quote.emailCta}
                </button>
                <a
                  href={PHONE_HREF}
                  className="flex items-center gap-2 font-display text-[13px] font-semibold uppercase tracking-eyebrow text-steel hover:text-navy"
                >
                  <Phone size={14} strokeWidth={2.5} />
                  {t.quote.callPrefix} {BUSINESS.phone}
                </a>
              </div>

              <div className="mt-5">
                <Link
                  href={`/configure?q=${quote.id}`}
                  className="inline-flex items-center gap-2 font-display text-[12px] font-semibold uppercase tracking-eyebrow text-steel hover:text-navy"
                >
                  <ArrowLeft size={12} strokeWidth={2.5} />
                  {t.quote.backLink}
                </Link>
              </div>

              {/* Invoice — line items */}
              <InvoiceCard
                t={t}
                lf={lf}
                familyName={familyName}
                breakdown={pricing.breakdown}
                rawSubtotal={pricing.raw_subtotal_cents}
                finalPrice={pricing.final_price_cents}
                reservationCreditCents={
                  quote.status === "deposit_paid" || quote.status === "won"
                    ? pricing.deposit_cents
                    : 0
                }
              />

              {/* Schedule preview */}
              <div className="mt-10">
                <div className="mb-4 flex items-center gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-spec text-brick">
                    {t.quote.scheduleEyebrow}
                  </span>
                  <span className="h-px flex-1 bg-navy/15" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {t.quote.scheduleCards.map((c) => (
                    <div
                      key={c.n}
                      className="rounded-sm border border-navy/15 bg-cream px-5 py-5"
                    >
                      <div className="font-mono text-[11px] uppercase tracking-spec text-brick">
                        {c.n}
                      </div>
                      <div className="mt-2 font-display text-[12px] font-semibold uppercase tracking-eyebrow text-steel">
                        {c.eyebrow}
                      </div>
                      <div className="mt-1 font-display text-[18px] font-bold uppercase leading-[1.1] tracking-[0.04em] text-navy">
                        {c.title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Wisetack financing — soft credit pull, monthly estimate. */}
              <div className="mt-8">
                <WisetackWidget
                  monthly24moCents={pricing.monthly_24mo_cents}
                />
              </div>
            </div>

            {/* ── Right column ────────────────────────────────── */}
            <aside className="space-y-5">
              <div className="overflow-hidden rounded-sm border border-brass/30 bg-navy text-cream shadow-card-lg">
                <div className="flex items-start justify-between gap-4 border-b border-cream/10 px-6 py-5">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-spec text-brass">
                      {t.quote.trustBlockEyebrow}
                    </div>
                    <div className="mt-1 font-display text-[20px] font-bold uppercase leading-[1] tracking-[0.04em] text-cream">
                      {t.quote.trustBlockTitle}
                    </div>
                  </div>
                  <StarCoin size={44} />
                </div>

                <ul className="px-6 py-5 space-y-4">
                  {inclusionsRendered.map((row) => (
                    <li key={row.title} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-pill border-2 border-brass bg-navy text-brass">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <div>
                        <div className="font-display text-[13px] font-semibold uppercase tracking-eyebrow text-cream">
                          {row.title}
                        </div>
                        <p className="mt-1 font-body text-[13px] leading-[1.5] text-cream/80">
                          {row.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="relative bg-navy-deep px-6 py-4">
                  <div className="text-center font-mono text-[11px] uppercase tracking-spec text-brass">
                    {t.quote.trustTagline}
                  </div>
                  <div
                    className="pickets pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 opacity-50"
                    aria-hidden="true"
                  >
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-sm border border-navy/15 bg-cream-deep px-6 py-5">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5 text-brass">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} fill="currentColor" strokeWidth={0} />
                    ))}
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-spec text-steel">
                    {t.quote.reviewBadge}
                  </span>
                </div>
                <p className="mt-3 font-body text-[14px] italic leading-[1.55] text-char">
                  &ldquo;{t.quote.reviewQuote}&rdquo;
                </p>
                <p className="mt-3 font-display text-[12px] font-semibold uppercase tracking-eyebrow text-navy">
                  {t.quote.reviewAttribution}
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <Footer />

      <EmailSheet
        quoteId={params.id}
        open={emailSheetOpen}
        onClose={() => setEmailSheetOpen(false)}
      />
    </div>
  );
}

interface CommitmentStepProps {
  t: ReturnType<typeof useT>;
  locale: string;
  quote: QuoteShape;
  reserving: boolean;
  holding: boolean;
  onReserve: () => void;
  onHold: () => void;
}

/**
 * Two-lane commitment step, shown after the instant quote:
 *  - reserved (paid)  → confirmation with the promised install week
 *  - price_hold       → held confirmation + a low-key "reserve" nudge
 *  - initial          → the two choice cards + reassurance line
 * Copy is bilingual and never uses the word "deposit".
 */
function CommitmentStep({
  t,
  locale,
  quote,
  reserving,
  holding,
  onReserve,
  onHold,
}: CommitmentStepProps) {
  const c = t.commitment;
  const reserved = quote.status === "deposit_paid" || quote.status === "won";
  const held = quote.commitmentLane === "price_hold" && !reserved;

  if (reserved) {
    const week = quote.reservedWeekStart
      ? formatInstallWeek(quote.reservedWeekStart, locale)
      : "";
    return (
      <div className="mt-6 rounded-sm border border-forest-600/30 bg-forest-50 p-5">
        <div className="flex items-start gap-3">
          <CalendarCheck
            size={20}
            strokeWidth={2}
            className="mt-0.5 flex-shrink-0 text-forest-600"
          />
          <p className="font-body text-[14px] leading-[1.55] text-char">
            {c.reservedConfirm.replace("{date}", week)}
          </p>
        </div>
      </div>
    );
  }

  if (held) {
    const through = quote.priceHoldExpiresAt
      ? new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
          month: "long",
          day: "numeric",
          timeZone: "America/Chicago",
        }).format(new Date(quote.priceHoldExpiresAt))
      : "";
    return (
      <div className="mt-6 rounded-sm border border-cream-deep bg-cream p-5">
        <p className="font-body text-[14px] leading-[1.55] text-char">
          {c.heldConfirm.replace("{date}", through)}
        </p>
        <button
          type="button"
          onClick={onReserve}
          disabled={reserving}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-sm border border-navy/30 px-5 font-display text-[13px] font-semibold uppercase tracking-eyebrow text-navy transition-colors hover:border-navy hover:bg-navy/5 disabled:opacity-50"
        >
          {reserving ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <CalendarCheck size={14} strokeWidth={2.5} />
          )}
          {c.heldReserveButton}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Card 1 — featured, champagne top border + MOST POPULAR pill */}
        <div className="relative overflow-hidden rounded-sm border border-cream-deep bg-white shadow-card">
          <div className="h-[3px] w-full bg-champagne" />
          <div className="flex h-full flex-col p-5">
            <span className="self-start rounded-pill bg-champagne px-3 py-0.5 font-display text-[10px] font-semibold uppercase tracking-eyebrow text-navy">
              {c.reservePill}
            </span>
            <h3 className="mt-3 font-display text-[19px] font-bold uppercase leading-[1.05] tracking-[0.01em] text-navy">
              {c.reserveHeading}
            </h3>
            <p className="mt-2 font-body text-[13px] leading-[1.5] text-char">
              {c.reserveBody}
            </p>
            <button
              type="button"
              onClick={onReserve}
              disabled={reserving}
              aria-label={c.reserveButton}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-champagne px-6 font-display text-[14px] font-semibold uppercase tracking-eyebrow text-navy shadow-cta transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {reserving ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <CalendarCheck size={15} strokeWidth={2.5} />
              )}
              {c.reserveButton}
            </button>
          </div>
        </div>

        {/* Card 2 — plain */}
        <div className="rounded-sm border border-cream-deep bg-white">
          <div className="flex h-full flex-col p-5">
            <h3 className="font-display text-[19px] font-bold uppercase leading-[1.05] tracking-[0.01em] text-navy">
              {c.holdHeading}
            </h3>
            <p className="mt-2 font-body text-[13px] leading-[1.5] text-char">
              {c.holdBody}
            </p>
            <button
              type="button"
              onClick={onHold}
              disabled={holding}
              className="mt-auto flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-navy/30 px-6 font-display text-[14px] font-semibold uppercase tracking-eyebrow text-navy transition-colors hover:border-navy hover:bg-navy/5 disabled:opacity-50"
            >
              {holding && <Loader2 className="animate-spin" size={16} />}
              {c.holdButton}
            </button>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center font-body text-[13px] leading-[1.5] text-steel">
        {c.reassurance}
      </p>
    </div>
  );
}

interface InvoiceCardProps {
  t: ReturnType<typeof useT>;
  lf: number;
  familyName: string;
  breakdown: PricingBreakdown;
  rawSubtotal: number;
  finalPrice: number;
  /** $ applied after an install-week reservation (0 otherwise). */
  reservationCreditCents: number;
}

function InvoiceCard({
  t,
  lf,
  familyName,
  breakdown,
  rawSubtotal,
  finalPrice,
  reservationCreditCents,
}: InvoiceCardProps) {
  const ratePerLf = lf > 0 ? breakdown.base_fence_cents / lf : 0;
  // Guards (margin floor + min profit) are INTERNAL pricing protections.
  // The customer never sees them as a labeled line item — instead the
  // delta is absorbed into the base-fence line so the breakdown still
  // sums to the displayed total. When a guard fires we also drop the
  // "(LF × rate)" hint from the base-fence label, since the implied
  // rate no longer matches once we've bumped the price.
  const guardDelta = finalPrice - rawSubtotal;
  const guardFired = guardDelta > 0;
  const adjustedBaseFence = breakdown.base_fence_cents + guardDelta;

  const baseFenceLabel = guardFired
    ? `${familyName} · Base Fence`
    : `${familyName} · ${t.quote.invoiceLineBase
        .replace("{lf}", lf.toFixed(0))
        .replace("{rate}", formatCents(Math.round(ratePerLf)))}`;

  // Ironclad bundles steel posts + stain & seal — the engine zeroes those
  // standalone charges when the bundle is active, so they fall out of the
  // filter below (no double-charge). They're re-surfaced as "included"
  // sub-lines under the Ironclad upgrade so the customer sees the value.
  const lines: Array<{ label: string; cents: number; included?: string[] }> = [
    { label: baseFenceLabel, cents: adjustedBaseFence },
    {
      label: "Ivory Standard upgrade",
      cents: breakdown.ironclad_cents,
      included: [
        "PostMaster steel posts · lifetime rot & bend warranty",
        "Stain & seal",
        "36″ post set · 240+ lbs concrete each",
        "3-yr workmanship · 10-yr post & picket warranty",
        "Manufacturer warranties on all materials",
      ],
    },
    { label: "Board-on-board privacy", cents: breakdown.board_on_board_cents },
    { label: "Steel post upgrade", cents: breakdown.steel_upgrade_cents },
    { label: "Cap rail + trim", cents: breakdown.cap_rail_cents },
    { label: "Black vinyl posts", cents: breakdown.match_vinyl_posts_cents },
    { label: t.quote.invoiceLineGates, cents: breakdown.gates_cents },
    { label: t.quote.invoiceLineDemo, cents: breakdown.demo_cents },
    { label: t.quote.invoiceLineStain, cents: breakdown.stain_cents },
    { label: "Rock drilling", cents: breakdown.rock_drilling_cents },
    { label: "Concrete-post removal", cents: breakdown.tear_concrete_cents },
  ].filter((l) => l.cents > 0);

  // Permits + buried line inspection — both are baked into the total, but
  // shown to the customer as "incl." so the $75 permit doesn't trigger
  // pushback. The permit cost is absorbed into the fence subtotal display.
  const inclusionRows = [
    {
      label: "Permits, pulled by us",
      value: t.quote.invoiceLineLineLocateValue,
    },
    {
      label: t.quote.invoiceLineLineLocate,
      value: t.quote.invoiceLineLineLocateValue,
    },
  ];

  return (
    <div className="mt-8 overflow-hidden rounded-sm border border-navy/15 bg-paper">
      <div className="flex items-center gap-3 border-b border-navy/10 bg-cream px-6 py-4">
        <span className="font-mono text-[11px] uppercase tracking-spec text-brick">
          {t.quote.invoiceEyebrow}
        </span>
        <span className="font-display text-[15px] font-semibold uppercase tracking-eyebrow text-navy">
          {t.quote.invoiceTitle}
        </span>
      </div>

      <div className="px-6 py-5">
        <ul className="space-y-2.5">
          {lines.flatMap((line) => {
            const rendered = [
              <li
                key={line.label}
                className="flex items-baseline justify-between gap-4 font-body text-[13.5px]"
              >
                <span className="text-char">{line.label}</span>
                <span className="font-mono text-[13px] tabular-nums text-navy">
                  {formatCents(line.cents)}
                </span>
              </li>,
            ];
            // Bundled-in items: listed under their parent line with no price.
            for (const inc of line.included ?? []) {
              rendered.push(
                <li
                  key={`${line.label}-${inc}`}
                  className="flex items-baseline justify-between gap-4 pl-4 font-body text-[12.5px]"
                >
                  <span className="text-steel">↳ {inc}</span>
                  <span className="font-mono text-[11px] uppercase tracking-spec text-steel">
                    included
                  </span>
                </li>
              );
            }
            return rendered;
          })}
          {/* Permits + OK811 line locate — both absorbed into the total but
              shown as "incl." so the customer reads them as bundled service,
              not separate add-ons. */}
          {inclusionRows.map((row) => (
            <li
              key={row.label}
              className="flex items-baseline justify-between gap-4 font-body text-[13.5px]"
            >
              <span className="text-char">{row.label}</span>
              <span className="font-mono text-[12px] uppercase tracking-spec text-steel">
                {row.value}
              </span>
            </li>
          ))}
        </ul>

        {reservationCreditCents > 0 && (
          <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-navy/10 pt-3 font-body text-[13.5px]">
            <span className="text-forest-600">{t.commitment.creditLineLabel}</span>
            <span className="font-mono text-[13px] tabular-nums text-forest-600">
              −{formatCents(reservationCreditCents)}
            </span>
          </div>
        )}

        <div className="mt-4 border-t-2 border-navy/20 pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-display text-[15px] font-semibold uppercase tracking-eyebrow text-navy">
              {t.quote.invoiceTotal}
            </span>
            <span className="font-display text-[24px] font-bold tabular-nums text-brick">
              {formatCents(finalPrice - reservationCreditCents)}
            </span>
          </div>
        </div>

        <p className="mt-4 font-body text-[11.5px] leading-[1.5] text-steel-soft">
          {t.quote.invoiceFooter}
        </p>
      </div>
    </div>
  );
}
