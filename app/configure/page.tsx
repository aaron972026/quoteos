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
  Check,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { Header } from "@/components/brand/Header";
import { Progress } from "@/components/brand/Progress";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { AddonRow } from "@/components/configure/AddonRow";
import { FenceSketch } from "@/components/configure/FenceSketch";
import { cn, formatCents } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-locale";

interface SkuApiRow {
  code: string;
  family: string;
  familyName: string;
  displayName: string;
  tier: "good" | "better" | "best" | null;
  description: string;
  heightInches: number;
  basePricePerLfCents: number;
  marketMaxPerLfCents: number | null;
  marketFlag: string | null;
  postsStandard: string | null;
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
  city: string | null;
  skuCode: string | null;
  stainSeal: boolean | null;
  steelPostUpgrade: boolean | null;
  capRailTrim: boolean | null;
  matchVinylPosts: boolean | null;
  ironclad: boolean | null;
  boardOnBoard: boolean | null;
  gates?: Array<{ type: string; count: number }> | null;
}

interface PricingResponse {
  final_price_cents: number;
  display_range_low_cents: number;
  display_range_high_cents: number;
  raw_subtotal_cents: number;
  guards_applied: string[];
  deposit_cents: number;
  valid_until: string;
  breakdown: {
    base_fence_cents: number;
    slope_surcharge_cents: number;
    access_surcharge_cents: number;
    steel_upgrade_cents: number;
    gates_cents: number;
    demo_cents: number;
    stain_cents: number;
    rock_drilling_cents: number;
    tear_concrete_cents: number;
    permit_cents: number;
  };
  warnings: string[];
}

// Wood-post families that can take the PostMaster+ steel-post upgrade.
// Mirrors STEEL_UPGRADE_FAMILIES in lib/pricing/data.ts.
const STEEL_UPGRADE_FAMILIES = new Set(["CPF", "HCF", "BP"]);

// Wood-picket families that can take the cap-rail + decorative trim upgrade.
const CAP_RAIL_FAMILIES = new Set(["CPF", "HCF", "BP"]);

const TIER_SLOT_LABEL: Record<"good" | "better" | "best", string> = {
  good: "Good",
  better: "Better",
  best: "Best",
};

const TIER_SLOT_ORDER: Array<"good" | "better" | "best"> = ["good", "better", "best"];

function ConfigurePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("q");
  const t = useT();

  const [skus, setSkus] = useState<SkuApiRow[] | null>(null);
  const [quote, setQuote] = useState<QuoteShape | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [familyCode, setFamilyCode] = useState<string | null>(null);
  const [skuCode, setSkuCode] = useState<string | null>(null);
  const [stainSeal, setStainSeal] = useState(false);
  const [steelPostUpgrade, setSteelPostUpgrade] = useState(false);
  const [capRailTrim, setCapRailTrim] = useState(false);
  const [matchVinylPosts, setMatchVinylPosts] = useState(false);
  // Ironclad Install bundle — steel posts + stain & seal + 36"/240lb set
  // + extended warranties at $13/LF. Absorbs the steel + stain add-ons.
  const [ironclad, setIronclad] = useState(false);
  // Board-on-board privacy — +$7/LF toggle (wood-picket families).
  const [boardOnBoard, setBoardOnBoard] = useState(false);

  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/v1/skus", { credentials: "include" }).then((r) => r.json()),
      quoteId
        ? fetch(`/api/v1/quotes/${quoteId}`, { credentials: "include" }).then(
            async (r) => {
              if (!r.ok) throw new Error(`${t.configure.quoteLoadFailed} (${r.status})`);
              return r.json();
            }
          )
        : Promise.reject(new Error(t.configure.missingQuote)),
    ])
      .then(([s, q]: [SkuApiRow[], QuoteShape]) => {
        if (cancelled) return;
        setSkus(s);
        setQuote(q);
        // Only adopt the quote's saved SKU if it still exists in the
        // active catalog. If the SKU was deactivated in admin after this
        // quote started, falling through leaves skuCode null so the
        // auto-pick effect selects a live SKU instead of pricing against
        // a dead one ("sku not available" / empty estimate).
        if (q.skuCode) {
          const picked = s.find((sk) => sk.code === q.skuCode);
          if (picked) {
            setSkuCode(q.skuCode);
            setFamilyCode(picked.family);
          }
        }
        // Restore add-on selections so a reload keeps the customer's
        // upgrades (and their price) instead of silently dropping them.
        if (q.stainSeal) setStainSeal(true);
        if (q.steelPostUpgrade) setSteelPostUpgrade(true);
        if (q.capRailTrim) setCapRailTrim(true);
        if (q.matchVinylPosts) setMatchVinylPosts(true);
        if (q.ironclad) setIronclad(true);
        if (q.boardOnBoard) setBoardOnBoard(true);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t.configure.loadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [
    quoteId,
    t.configure.quoteLoadFailed,
    t.configure.missingQuote,
    t.configure.loadFailed,
  ]);

  // Group SKUs by family with tier-slot lookup
  const families = useMemo(() => {
    if (!skus) return [];
    const byFamily = new Map<
      string,
      { code: string; name: string; variants: SkuApiRow[] }
    >();
    for (const s of skus) {
      const existing = byFamily.get(s.family);
      if (existing) {
        existing.variants.push(s);
      } else {
        byFamily.set(s.family, {
          code: s.family,
          name: s.familyName,
          variants: [s],
        });
      }
    }
    const famList = Array.from(byFamily.values());
    for (const fam of famList) {
      fam.variants.sort(
        (a: SkuApiRow, b: SkuApiRow) =>
          TIER_SLOT_ORDER.indexOf((a.tier ?? "good") as "good") -
          TIER_SLOT_ORDER.indexOf((b.tier ?? "good") as "good")
      );
    }
    // Stable family order: cheapest variant first.
    return famList.sort(
      (a: { variants: SkuApiRow[] }, b: { variants: SkuApiRow[] }) => {
        const aMin = Math.min(...a.variants.map((v) => v.basePricePerLfCents));
        const bMin = Math.min(...b.variants.map((v) => v.basePricePerLfCents));
        return aMin - bMin;
      }
    );
  }, [skus]);

  const selectedFamily = families.find((f) => f.code === familyCode) ?? null;
  const selectedSku = skus?.find((s) => s.code === skuCode) ?? null;
  const steelUpgradeAvailable = selectedSku
    ? STEEL_UPGRADE_FAMILIES.has(selectedSku.family)
    : false;

  // (No auto-pick.) Earlier this effect landed on families[0] (Chain Link)
  // + its first variant on mount, which made the page display a running
  // estimate the customer hadn't chosen. The estimate card + sticky CTA
  // below now render conditionally on selectedSku, so the customer sees
  // pricing only after explicitly picking a style.

  // When family changes, default the SKU to the middle tier (or the only one)
  function handleFamilyPick(code: string) {
    setFamilyCode(code);
    const fam = families.find((f) => f.code === code);
    if (!fam) return;
    // Ironclad-eligible families show only the basic variant + the Ironclad
    // upgrade, so default to the basic. Other families keep the "better"
    // (most-picked) default across their full tier lineup.
    const defaultPick = STEEL_UPGRADE_FAMILIES.has(fam.code)
      ? fam.variants[0]
      : fam.variants.find((v) => v.tier === "better") ?? fam.variants[0];
    if (defaultPick) setSkuCode(defaultPick.code);
    setIronclad(false);
  }

  // Reset upgrades that don't apply to the picked family/SKU
  useEffect(() => {
    if (!selectedSku) return;
    if (!STEEL_UPGRADE_FAMILIES.has(selectedSku.family) && steelPostUpgrade) {
      setSteelPostUpgrade(false);
    }
    if (!CAP_RAIL_FAMILIES.has(selectedSku.family) && capRailTrim) {
      setCapRailTrim(false);
    }
    if (!CAP_RAIL_FAMILIES.has(selectedSku.family) && boardOnBoard) {
      setBoardOnBoard(false);
    }
    if (!STEEL_UPGRADE_FAMILIES.has(selectedSku.family) && ironclad) {
      setIronclad(false);
    }
    if (selectedSku.code !== "CL-VIN" && matchVinylPosts) {
      setMatchVinylPosts(false);
    }
  }, [selectedSku, steelPostUpgrade, capRailTrim, matchVinylPosts, boardOnBoard, ironclad]);

  // Live pricing
  useEffect(() => {
    if (!skuCode || !quote || !quote.linearFeet) return;
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
            gates: quote.gates ?? [],
            stain_seal: stainSeal,
            ironclad,
            board_on_board: boardOnBoard,
            steel_post_upgrade: steelPostUpgrade,
            cap_rail_trim: capRailTrim,
            match_vinyl_posts: matchVinylPosts,
            city: quote.city ?? "Tulsa",
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
  }, [skuCode, stainSeal, steelPostUpgrade, capRailTrim, matchVinylPosts, ironclad, boardOnBoard, quote]);

  function handleContinue() {
    if (!quoteId || !skuCode) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await fetch(`/api/v1/quotes/${quoteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            sku_code: skuCode,
            // stain_seal persists true under Ironclad so the BOM orders
            // stain materials; the engine zeroes its charge when bundled.
            stain_seal: stainSeal || ironclad,
            ironclad,
            board_on_board: boardOnBoard,
            steel_post_upgrade: steelPostUpgrade,
            cap_rail_trim: capRailTrim,
            match_vinyl_posts: matchVinylPosts,
          }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? t.configure.couldNotSave);
        }
        router.push(`/quote/${quoteId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : t.configure.couldNotSave);
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

  if (!quote || !skus) {
    return (
      <div className="flex min-h-dvh flex-col bg-paper">
        <Header dark />
        <Progress step={3} dark />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="animate-spin text-navy/40" size={32} />
        </main>
      </div>
    );
  }

  const lf = Number(quote.linearFeet) || 0;
  const ironcladEligible =
    !!selectedFamily && STEEL_UPGRADE_FAMILIES.has(selectedFamily.code);
  // The basic (cheapest) variant — variants are tier-sorted, so [0] is the
  // lowest tier. On Ironclad-eligible families we show ONLY this basic card
  // plus the Ironclad upgrade (same SKU + the $13/LF install bundle), so the
  // customer compares basic cost vs. the upgraded install — nothing else.
  const baseVariant = selectedFamily?.variants[0] ?? null;
  const ironcladAnchor = baseVariant;
  const displayVariants =
    ironcladEligible && baseVariant
      ? [baseVariant]
      : selectedFamily?.variants ?? [];
  const tierCardCount = displayVariants.length + (ironcladEligible ? 1 : 0);
  const gateCount = Array.isArray(quote.gates)
    ? quote.gates.reduce((sum, g) => sum + (g.count ?? 0), 0)
    : 0;
  const gateText =
    gateCount === 0
      ? "no gates"
      : gateCount === 1
        ? "1 gate"
        : `${gateCount} gates`;
  const helperLine = t.configure.helper
    .replace("{lf}", lf.toFixed(0))
    .replace("{gates}", gateText);

  return (
    <div className="flex min-h-dvh flex-col bg-paper pb-20 lg:pb-0">
      <Header dark />
      <Progress step={3} dark />

      <section className="flex-1">
        <div className="mx-auto max-w-[1280px] px-5 py-8 md:px-10 md:py-12">
          {/* Header row — chip stacks above the heading on mobile so the
              wrapping lead paragraph never visually collides with it. */}
          <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
            {quoteId && (
              <div className="order-first font-mono text-[11px] uppercase tracking-spec text-brick md:order-last">
                QUOTE-IN-PROGRESS · {quoteId.slice(0, 8).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <Eyebrow>{t.configure.eyebrow}</Eyebrow>
              <h2 className="mt-3 font-display text-[32px] font-bold uppercase leading-[1] tracking-[0.01em] text-navy sm:text-[36px] md:text-[44px]">
                {t.configure.title}
              </h2>
              <p className="mt-3 max-w-[64ch] font-body text-[14.5px] leading-[1.55] text-char sm:text-[15px]">
                {helperLine}
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
            {/* ── Left column ─────────────────────────────────────── */}
            <div>
              {/* Section 01 — Family cards (large, with fence-style sketches) */}
              <SectionHeader num="01" label="Pick A Style" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {families.map((f) => {
                  const selected = familyCode === f.code;
                  const cheapest = Math.min(
                    ...f.variants.map((v) => v.basePricePerLfCents)
                  );
                  return (
                    <button
                      key={f.code}
                      type="button"
                      onClick={() => handleFamilyPick(f.code)}
                      aria-pressed={selected}
                      className={cn(
                        "group relative flex flex-col rounded-sm border p-4 text-left transition-all",
                        selected
                          ? "border-navy bg-cream shadow-card-lg ring-2 ring-brass/40"
                          : "border-navy/15 bg-paper hover:border-navy/40"
                      )}
                    >
                      {selected && (
                        <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-pill bg-brass text-navy shadow-card-lg">
                          <Check size={14} strokeWidth={3} />
                        </span>
                      )}
                      <div
                        className={cn(
                          "mb-3 flex h-[60px] w-[80px] items-center justify-center rounded-sm border",
                          selected
                            ? "border-navy/30 bg-paper text-navy"
                            : "border-navy/15 bg-navy/5 text-navy/60"
                        )}
                      >
                        <FenceSketch family={f.code} />
                      </div>
                      <div className="font-display text-[13px] font-semibold uppercase tracking-eyebrow text-navy">
                        {f.name}
                      </div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-spec text-steel">
                          FROM
                        </span>
                        <span className="font-display text-[18px] font-bold tabular-nums text-brick">
                          {formatCents(cheapest)}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-spec text-steel">
                          {t.configure.perLF}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Section 02 — Tier within family */}
              {selectedFamily && (
                <>
                  <div className="mt-10">
                    <SectionHeader
                      num="02"
                      label={`Pick A Level · ${selectedFamily.name}`}
                    />
                  </div>
                  <div
                    role="radiogroup"
                    aria-label="Tier selection"
                    className={cn(
                      "mt-5 grid gap-4",
                      tierCardCount >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
                    )}
                  >
                    {displayVariants.map((v) => {
                      const selected = skuCode === v.code && !ironclad;
                      const slot = v.tier;
                      // On Ivory-Standard-eligible families this is the lone
                      // base card paired against the Ivory Standard upgrade —
                      // label it "Essential" so the two tiers read distinctly
                      // (not "Standard" vs "Ivory Standard").
                      const slotLabel = ironcladEligible
                        ? "Essential"
                        : slot
                          ? TIER_SLOT_LABEL[slot]
                          : "Option";
                      // Ironclad owns the Most Picked badge when its slot renders.
                      const popular = slot === "better" && !ironcladEligible;
                      return (
                        <button
                          key={v.code}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => {
                            setSkuCode(v.code);
                            setIronclad(false);
                          }}
                          className={cn(
                            "group relative flex flex-col rounded-sm border p-5 pt-7 text-left transition-all",
                            selected
                              ? "border-navy bg-navy text-cream shadow-card-lg ring-2 ring-brass/40"
                              : "border-navy/15 bg-paper text-navy hover:border-navy/40"
                          )}
                        >
                          {popular && (
                            <span
                              className={cn(
                                "absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-pill px-3 py-0.5 font-display text-[10px] font-semibold uppercase tracking-eyebrow",
                                selected
                                  ? "bg-brass text-navy"
                                  : "bg-brick text-cream"
                              )}
                            >
                              {t.configure.mostPicked}
                            </span>
                          )}

                          {/* BIG GOOD / BETTER / BEST label — the dominant text. */}
                          <div
                            className={cn(
                              "font-display text-[32px] font-bold uppercase leading-[0.95] tracking-[0.02em]",
                              selected ? "text-brass" : "text-brick"
                            )}
                          >
                            {slotLabel}
                          </div>

                          {/* Friendly variant name + description (sub-label). */}
                          <div
                            className={cn(
                              "mt-2 font-display text-[13px] font-semibold uppercase tracking-eyebrow",
                              selected ? "text-cream" : "text-navy"
                            )}
                          >
                            {v.displayName}
                          </div>
                          <p
                            className={cn(
                              "mt-2 font-body text-[12.5px] leading-[1.45]",
                              selected ? "text-cream/80" : "text-steel"
                            )}
                          >
                            {v.description}
                          </p>

                          <div className="mt-4 flex items-baseline gap-1.5">
                            <span
                              className={cn(
                                "font-display text-[24px] font-bold tabular-nums",
                                selected ? "text-cream" : "text-navy"
                              )}
                            >
                              {formatCents(v.basePricePerLfCents)}
                            </span>
                            <span
                              className={cn(
                                "font-mono text-[10px] uppercase tracking-spec",
                                selected ? "text-cream/60" : "text-steel"
                              )}
                            >
                              {t.configure.perLF}
                            </span>
                          </div>

                          {v.specBullets.length > 0 && (
                            <ul className="mt-3 space-y-1.5">
                              {v.specBullets.slice(0, 4).map((bullet) => (
                                <li
                                  key={bullet}
                                  className={cn(
                                    "flex items-start gap-1.5 font-body text-[12px] leading-[1.45]",
                                    selected ? "text-cream/80" : "text-char"
                                  )}
                                >
                                  <Check
                                    size={12}
                                    strokeWidth={2.5}
                                    className={cn(
                                      "mt-1 flex-shrink-0",
                                      selected ? "text-brass" : "text-brick"
                                    )}
                                  />
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </button>
                      );
                    })}

                    {/* Ironclad slot — replaces the old "Best" box on
                        wood-post families. Rides the anchor variant +
                        the $13/LF bundle; selecting it sets both. */}
                    {ironcladEligible && ironcladAnchor && (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={ironclad}
                        onClick={() => {
                          setSkuCode(ironcladAnchor.code);
                          setIronclad(true);
                        }}
                        className={cn(
                          "group relative flex flex-col rounded-sm border p-5 pt-7 text-left transition-all",
                          ironclad
                            ? "border-navy bg-navy text-cream shadow-card-lg ring-2 ring-brass/40"
                            : "border-navy/15 bg-paper text-navy hover:border-navy/40"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-pill px-3 py-0.5 font-display text-[10px] font-semibold uppercase tracking-eyebrow",
                            ironclad ? "bg-brass text-navy" : "bg-brick text-cream"
                          )}
                        >
                          Most Picked
                        </span>

                        <div
                          className={cn(
                            "font-display text-[32px] font-bold uppercase leading-[0.95] tracking-[0.02em]",
                            ironclad ? "text-brass" : "text-brick"
                          )}
                        >
                          Ivory Standard
                        </div>

                        <div
                          className={cn(
                            "mt-2 font-display text-[13px] font-semibold uppercase tracking-eyebrow",
                            ironclad ? "text-cream" : "text-navy"
                          )}
                        >
                          Premium Cedar · Warranty-Protected Installation
                        </div>
                        <p
                          className={cn(
                            "mt-2 font-body text-[12.5px] leading-[1.45]",
                            ironclad ? "text-cream/80" : "text-steel"
                          )}
                        >
                          {ironcladAnchor.displayName}, built and backed to
                          outlast the weather.
                        </p>

                        <div className="mt-4 flex items-baseline gap-1.5">
                          <span
                            className={cn(
                              "font-display text-[24px] font-bold tabular-nums",
                              ironclad ? "text-cream" : "text-navy"
                            )}
                          >
                            {formatCents(
                              ironcladAnchor.basePricePerLfCents + 1300
                            )}
                          </span>
                          <span
                            className={cn(
                              "font-mono text-[10px] uppercase tracking-spec",
                              ironclad ? "text-cream/60" : "text-steel"
                            )}
                          >
                            {t.configure.perLF}
                          </span>
                        </div>

                        <ul className="mt-3 space-y-1.5">
                          {[
                            "PostMaster steel posts — lifetime rot & bend warranty",
                            "Set 36″ deep · 240+ lbs concrete each",
                            "Stain & Seal included ($6/LF value)",
                            "3-Year workmanship · 10-Year post & picket coverage",
                            "Manufacturer warranties on all materials, passed through in full",
                          ].map((bullet) => (
                            <li
                              key={bullet}
                              className={cn(
                                "flex items-start gap-1.5 font-body text-[12px] leading-[1.45]",
                                ironclad ? "text-cream/80" : "text-char"
                              )}
                            >
                              <Check
                                size={12}
                                strokeWidth={2.5}
                                className={cn(
                                  "mt-1 flex-shrink-0",
                                  ironclad ? "text-brass" : "text-brick"
                                )}
                              />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>

                        {lf > 0 && (
                          <p
                            className={cn(
                              "mt-3 border-t pt-3 font-body text-[12px] leading-[1.45]",
                              ironclad
                                ? "border-cream/15 text-cream/75"
                                : "border-navy/10 text-steel"
                            )}
                          >
                            About{" "}
                            <span className="font-semibold">
                              {formatCents(Math.round((1300 * lf) / 180))}/month
                            </span>{" "}
                            more over the 10 years it&rsquo;s guaranteed. One
                            wood-post repair runs $200–300.
                          </p>
                        )}
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Customize toggles — appear after the customer picks a tier
                  so the screen flows family → level → upgrades. */}
              <div className="mt-10">
                <SectionHeader num="03" label="Add Upgrades" />
              </div>
              <div className="mt-4 space-y-3">
                <AddonRow
                  label={t.configure.addonStain}
                  description={t.configure.addonStainDesc}
                  priceLabel={ironclad ? "Included" : t.configure.addonStainPrice}
                  checked={stainSeal || ironclad}
                  disabled={ironclad}
                  disabledReason="Included with Ivory Standard."
                  onChange={setStainSeal}
                />
                <AddonRow
                  label="Steel Post Upgrade (PostMaster+)"
                  description="Galvanized, powder-coated PostMaster+ steel posts — lifetime rot & bend warranty, rated to 130 mph wind."
                  priceLabel={ironclad ? "Included" : "+$5/LF"}
                  checked={steelPostUpgrade || ironclad}
                  disabled={!steelUpgradeAvailable || ironclad}
                  disabledReason={
                    ironclad
                      ? "Included with Ivory Standard."
                      : "Available on cedar + pine wood-post families."
                  }
                  onChange={setSteelPostUpgrade}
                />
                <AddonRow
                  label="Board-on-Board Privacy"
                  description="Overlapped pickets — zero gaps as the wood dries. Full privacy from every angle."
                  priceLabel="+$7/LF"
                  checked={boardOnBoard}
                  disabled={
                    !selectedSku || !CAP_RAIL_FAMILIES.has(selectedSku.family)
                  }
                  disabledReason="Available on wood-picket families (cedar, horizontal cedar, pine)."
                  onChange={setBoardOnBoard}
                />
                <AddonRow
                  label="Cap Rail + Trim"
                  description="Decorative cap rail and trim board — finishes the top edge and hides picket ends."
                  priceLabel="+$4/LF"
                  checked={capRailTrim}
                  disabled={
                    !selectedSku ||
                    !CAP_RAIL_FAMILIES.has(selectedSku.family)
                  }
                  disabledReason="Available on wood-picket families (cedar, horizontal cedar, pine)."
                  onChange={setCapRailTrim}
                />
                <AddonRow
                  label="Match Black Vinyl Posts"
                  description="Coat the line posts in matching black PVC so the whole fence reads as one piece."
                  priceLabel="+$3/LF"
                  checked={matchVinylPosts}
                  disabled={selectedSku?.code !== "CL-VIN"}
                  disabledReason="Pair with the Vinyl-Coated Black chain link option."
                  onChange={setMatchVinylPosts}
                />
              </div>

              {error && (
                <div className="mt-4 rounded-sm border border-brick/30 bg-brick/5 px-3 py-2 text-sm text-brick">
                  {error}
                </div>
              )}
            </div>

            {/* ── Right column — Running estimate ────────────────
                Only rendered once the customer has selected a SKU.
                Before that, showing a number would be the auto-picked
                default and felt like a pre-decision. */}
            {selectedSku && (
            <aside className="order-first lg:order-last">
              <div className="lg:sticky lg:top-6 lg:self-start">
                <div className="rounded-sm border border-brass/30 bg-navy p-6 text-cream shadow-card-lg">
                  <div className="font-mono text-[11px] uppercase tracking-spec text-brass">
                    {t.configure.estimateEyebrow}
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-display text-[40px] font-bold leading-none tabular-nums text-cream">
                      {pricing?.final_price_cents != null
                        ? formatCents(pricing.final_price_cents)
                        : "—"}
                    </span>
                    {pricingLoading && (
                      <Loader2
                        size={16}
                        className="animate-spin text-cream/60"
                      />
                    )}
                  </div>
                  <p className="mt-2 font-body text-[12px] leading-[1.45] text-cream/65">
                    {t.configure.estimateHelper}
                  </p>

                  <div className="mt-5 space-y-2 border-t border-cream/15 pt-4">
                    <EstimateRow
                      label={selectedSku?.familyName ?? "Fence"}
                      value={lf > 0 ? `${lf.toFixed(0)} LF` : "—"}
                    />
                    {selectedSku && (
                      <EstimateRow
                        label={selectedSku.displayName}
                        value={
                          selectedSku.tier
                            ? TIER_SLOT_LABEL[selectedSku.tier]
                            : ""
                        }
                      />
                    )}
                    {gateCount > 0 && (
                      <EstimateRow label={gateText} value={`${gateCount} ×`} />
                    )}
                    {quote.demoType && quote.demoType !== "NONE" && (
                      <EstimateRow label="Tear-out & haul" value="incl." />
                    )}
                    {ironclad && (
                      <EstimateRow label="Ivory Standard" value="✓" />
                    )}
                    {stainSeal && !ironclad && (
                      <EstimateRow label={t.configure.addonStain} value="✓" />
                    )}
                    {steelPostUpgrade && !ironclad && (
                      <EstimateRow label="Steel posts" value="✓" />
                    )}
                    {boardOnBoard && (
                      <EstimateRow label="Board-on-board" value="✓" />
                    )}
                    {capRailTrim && (
                      <EstimateRow label="Cap rail + trim" value="✓" />
                    )}
                    {matchVinylPosts && (
                      <EstimateRow label="Black vinyl posts" value="✓" />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleContinue}
                    disabled={!skuCode || isPending}
                    className={cn(
                      "mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-sm bg-brick",
                      "font-display text-[14px] font-semibold uppercase tracking-eyebrow text-cream",
                      "transition-colors hover:bg-brick-deep disabled:cursor-not-allowed disabled:bg-steel-soft"
                    )}
                  >
                    {isPending ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <>
                        {t.configure.continueCta}
                        <ArrowRight size={14} strokeWidth={2.5} />
                      </>
                    )}
                  </button>

                  <Link
                    href={`/draw?q=${quoteId}`}
                    className="mt-4 flex items-center justify-center gap-2 font-display text-[12px] font-semibold uppercase tracking-eyebrow text-cream/70 hover:text-cream"
                  >
                    <ArrowLeft size={12} strokeWidth={2.5} />
                    {t.configure.backLink}
                  </Link>
                </div>

                <div className="mt-4 rounded-sm border border-navy/15 bg-cream-deep p-5">
                  <div className="font-mono text-[10px] uppercase tracking-spec text-brick">
                    {t.configure.coverageTitle}
                  </div>
                  <p className="mt-2 font-body text-[12.5px] leading-[1.5] text-char">
                    {ironclad
                      ? t.configure.coverageBodyIvory
                      : t.configure.coverageBody}
                  </p>
                </div>
              </div>
            </aside>
            )}
          </div>
        </div>
      </section>

      {/* Sticky mobile CTA — live total + Continue pinned to the bottom.
          Hidden until a SKU is selected (matches the desktop estimate
          aside above — both surfaces appear only after the customer
          has explicitly picked a style). */}
      {selectedSku && (
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-navy/15 bg-navy lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[22px] font-bold leading-none tabular-nums text-cream">
                {pricing?.final_price_cents != null
                  ? formatCents(pricing.final_price_cents)
                  : "—"}
              </span>
              {pricingLoading && (
                <Loader2 size={12} className="animate-spin text-cream/60" />
              )}
            </div>
            <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-spec text-cream/60">
              {t.configure.estimateEyebrow}
            </div>
          </div>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!skuCode || isPending}
            className={cn(
              "flex h-12 flex-shrink-0 items-center gap-2 rounded-sm bg-brick px-6",
              "font-display text-[14px] font-semibold uppercase tracking-eyebrow text-cream",
              "transition-colors hover:bg-brick-deep disabled:cursor-not-allowed disabled:bg-steel-soft"
            )}
          >
            {isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <>
                {t.configure.continueCta}
                <ArrowRight size={14} strokeWidth={2.5} />
              </>
            )}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

function SectionHeader({ num, label }: { num: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[12px] uppercase tracking-spec text-brick">
        {num}
      </span>
      <span className="font-display text-[16px] font-semibold uppercase tracking-eyebrow text-navy">
        {label}
      </span>
      <span className="h-px flex-1 bg-navy/15" />
    </div>
  );
}

function EstimateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 font-body text-[12.5px]">
      <span className="truncate text-cream/80">{label}</span>
      <span className="flex-shrink-0 font-mono text-[12px] tabular-nums text-cream">
        {value}
      </span>
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
