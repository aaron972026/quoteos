"use client";

import { useEffect, useMemo, useRef, useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  DoorOpen,
  HelpCircle,
  Loader2,
  Plus,
  RotateCcw,
  Spline,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import { Header } from "@/components/brand/Header";
import { Progress } from "@/components/brand/Progress";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { DrawHelpModal } from "@/components/brand/DrawHelpModal";
import { SlopeSelfReport, type DetectedSlope } from "@/components/map/SlopeSelfReport";
import { DemoToggle } from "@/components/map/DemoToggle";
import {
  PhotoUpload,
  type PhotoAudit,
  type QuotePhoto,
} from "@/components/draw/PhotoUpload";
import type {
  FenceGeometryStats,
  FenceMapHandle,
  ParcelBoundary,
  PlacedGate,
} from "@/components/map/FenceMap";
import {
  NeighborPanel,
  type NeighborSummary,
} from "@/components/draw/NeighborPanel";
import type { Direction } from "@/lib/integrations/regrid";
import type { GateType } from "@/lib/pricing/types";
import { isSelfIntersecting } from "@/lib/map/linear-feet";
import { useT } from "@/lib/i18n/use-locale";
import { cn } from "@/lib/utils";

const FenceMap = dynamic(() => import("@/components/map/FenceMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-navy/5">
      <Loader2 className="animate-spin text-navy/40" size={32} />
    </div>
  ),
});

const GATE_SIZES: Array<{ type: GateType; label: string; sublabel: string }> = [
  { type: "W4", label: "4'", sublabel: "Walk" },
  { type: "W5", label: "5'", sublabel: "Walk" },
  { type: "D10", label: "10'", sublabel: "Drive" },
  { type: "D12", label: "12'", sublabel: "Drive" },
  { type: "D16", label: "16'", sublabel: "Double drive" },
];

interface QuoteShape {
  id: string;
  lat: string | number | null;
  lng: string | number | null;
  addressLine: string | null;
  zip: string | null;
  photoUrls?: QuotePhoto[] | null;
  photoAudit?: PhotoAudit | null;
  parcelBoundary?: ParcelBoundary | null;
  adjacentParcels?: Array<{
    parcelId: string | null;
    address: string | null;
    direction: Direction;
    boundary: ParcelBoundary;
  }> | null;
}

function DrawPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("q");
  const t = useT();

  const [quote, setQuote] = useState<QuoteShape | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<FenceGeometryStats>({
    feature: null,
    linear_feet: 0,
    corner_count: 0,
    closed: false,
  });
  const [slopeCode, setSlopeCode] = useState<number>(0);
  const [detectedSlope, setDetectedSlope] = useState<DetectedSlope | null>(null);
  const [slopeDetecting, setSlopeDetecting] = useState(false);
  const slopeUserOverrodeRef = useRef(false);
  const [demoRequired, setDemoRequired] = useState(false);
  const [gates, setGates] = useState<PlacedGate[]>([]);
  const [gateMode, setGateMode] = useState(false);
  const [pendingGatePoint, setPendingGatePoint] = useState<{ lat: number; lng: number } | null>(null);
  const [photos, setPhotos] = useState<QuotePhoto[]>([]);
  const [initialAudit, setInitialAudit] = useState<PhotoAudit | null>(null);
  const [parcelBoundary, setParcelBoundary] = useState<ParcelBoundary | null>(null);
  const [neighbors, setNeighbors] = useState<NeighborSummary[]>([]);
  const [adjacentBoundaries, setAdjacentBoundaries] = useState<ParcelBoundary[]>([]);
  const [isPending, startTransition] = useTransition();
  const [helpOpen, setHelpOpen] = useState(false);

  const mapRef = useRef<FenceMapHandle>(null);

  // Auto-open the click-through onboarding on first visit. localStorage
  // is checked in an effect (not at state init) to avoid SSR / hydration
  // mismatches. The flag is per-browser, scoped to the v1 onboarding copy.
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (!window.localStorage.getItem("qos-draw-onboarded-v1")) {
        setHelpOpen(true);
        window.localStorage.setItem("qos-draw-onboarded-v1", "1");
      }
    } catch {
      // localStorage can throw in private mode — just skip the onboarding
    }
  }, []);

  useEffect(() => {
    if (!quoteId) {
      setError(t.draw.missingQuote);
      return;
    }
    let cancelled = false;
    fetch(`/api/v1/quotes/${quoteId}`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${t.draw.couldNotLoadQuote} (${r.status})`);
        return r.json();
      })
      .then((q) => {
        if (cancelled) return;
        if (q?.lat == null || q?.lng == null) {
          throw new Error(t.draw.missingCoords);
        }
        setQuote(q);
        if (Array.isArray(q.photoUrls)) setPhotos(q.photoUrls);
        if (q.photoAudit) setInitialAudit(q.photoAudit as PhotoAudit);
        if (q.parcelBoundary) {
          setParcelBoundary(q.parcelBoundary as ParcelBoundary);
        }
        if (Array.isArray(q.adjacentParcels)) {
          const adj = q.adjacentParcels as NonNullable<QuoteShape["adjacentParcels"]>;
          setNeighbors(
            adj.map((n) => ({
              parcelId: n.parcelId,
              address: n.address,
              direction: n.direction,
            }))
          );
          setAdjacentBoundaries(adj.map((n) => n.boundary));
        }
        const needsLookup = !q.parcelBoundary || !Array.isArray(q.adjacentParcels);
        if (needsLookup) {
          fetch("/api/v1/parcels/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ quote_id: q.id }),
          })
            .then(async (r) => {
              if (!r.ok) return;
              const body = await r.json().catch(() => null);
              if (body?.parcel_boundary) {
                setParcelBoundary(body.parcel_boundary as ParcelBoundary);
              }
              if (Array.isArray(body?.adjacent_parcels)) {
                const adj = body.adjacent_parcels as Array<{
                  parcelId: string | null;
                  address: string | null;
                  direction: Direction;
                  boundary: ParcelBoundary;
                }>;
                setNeighbors(
                  adj.map((n) => ({
                    parcelId: n.parcelId,
                    address: n.address,
                    direction: n.direction,
                  }))
                );
                setAdjacentBoundaries(adj.map((n) => n.boundary));
              }
            })
            .catch(() => {});
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t.draw.couldNotLoadQuote);
      });
    return () => {
      cancelled = true;
    };
  }, [quoteId, t.draw.missingQuote, t.draw.couldNotLoadQuote, t.draw.missingCoords]);

  useEffect(() => {
    if (!stats.feature) return;
    if (stats.linear_feet < 20) return;
    const ctl = new AbortController();
    setSlopeDetecting(true);
    const timer = setTimeout(async () => {
      try {
        const r = await fetch("/api/v1/elevation/slope-detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: ctl.signal,
          body: JSON.stringify({ geometry: stats.feature?.geometry }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => null);
          console.warn("[slope-detect] non-ok", r.status, body);
          return;
        }
        const json = (await r.json()) as DetectedSlope & {
          upstream_statuses?: (number | null)[];
        };
        console.info("[slope-detect]", {
          slope_code: json.slope_code,
          max_grade_pct: json.max_grade_pct,
          resolved_samples: json.resolved_samples,
          total_samples: json.total_samples,
          upstream_statuses: json.upstream_statuses,
        });
        setDetectedSlope(json);
        if (!slopeUserOverrodeRef.current && json.resolved_samples >= 2) {
          setSlopeCode(json.slope_code);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          console.error("[slope-detect]", e);
        }
      } finally {
        setSlopeDetecting(false);
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [stats.feature, stats.linear_feet]);

  function handleSlopeOverride(v: 0 | 2) {
    setSlopeCode(v);
    slopeUserOverrodeRef.current = true;
  }

  function handleReset() {
    setStats({ feature: null, linear_feet: 0, corner_count: 0, closed: false });
    setGates([]);
    setGateMode(false);
    setPendingGatePoint(null);
    setDetectedSlope(null);
    slopeUserOverrodeRef.current = false;
    mapRef.current?.reset();
  }

  function handlePickGateSize(type: GateType) {
    if (!pendingGatePoint) return;
    setGates((prev) => [...prev, { type, count: 1, position: pendingGatePoint }]);
    setPendingGatePoint(null);
  }

  function handleGateMove(index: number, position: { lat: number; lng: number }) {
    setGates((prev) => prev.map((g, i) => (i === index ? { ...g, position } : g)));
  }

  function handleGateDelete(index: number) {
    setGates((prev) => prev.filter((_, i) => i !== index));
  }

  const crossesItself = useMemo(
    () => (stats.feature ? isSelfIntersecting(stats.feature) : false),
    [stats.feature]
  );

  function handleContinue() {
    if (!quoteId || !stats.feature) return;
    if (stats.linear_feet < 5) {
      setError(t.draw.needFenceLine);
      return;
    }
    if (isSelfIntersecting(stats.feature)) {
      setError(t.draw.crossesItselfFull);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const r = await fetch(`/api/v1/quotes/${quoteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            geometry: stats.feature,
            linear_feet: stats.linear_feet,
            corner_count: stats.corner_count,
            slope_code: slopeCode,
            slope_self_reported: slopeUserOverrodeRef.current,
            demo_required: demoRequired,
            demo_type: demoRequired ? "CEDAR" : "NONE",
            gates,
          }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? t.draw.couldNotSaveFence);
        }
        router.push(`/configure?q=${quoteId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : t.draw.couldNotSaveFence);
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

  if (!quote) {
    return (
      <div className="flex min-h-dvh flex-col bg-paper">
        <Header dark />
        <Progress step={2} dark />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="animate-spin text-navy/40" size={32} />
        </main>
      </div>
    );
  }

  const lat = Number(quote.lat);
  const lng = Number(quote.lng);
  const canContinue =
    !!stats.feature && stats.linear_feet >= 5 && !isPending && !crossesItself;

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <Header dark />
      <Progress step={2} dark />

      <section className="flex-1">
        <div className="mx-auto grid max-w-[1280px] gap-6 px-5 py-6 md:px-10 md:py-10 lg:grid-cols-[1fr_360px]">
          {/* Mobile-only intro — sits above the map so customers see the
              core instruction before the satellite. Hidden on desktop where
              the right column carries the same content. */}
          <div className="order-1 lg:hidden">
            <Eyebrow>{t.draw.eyebrow}</Eyebrow>
            <h2 className="mt-3 font-display text-[26px] font-bold uppercase leading-[1.05] tracking-[0.01em] text-navy">
              {t.draw.panelTitle}
            </h2>
            <p className="mt-2 font-body text-[14px] leading-[1.5] text-char">
              {t.draw.panelHelp}
            </p>
          </div>

          {/* ── Map column ───────────────────────────────────────── */}
          <div className="order-2 lg:order-1">
            <div
              className={cn(
                "relative overflow-hidden rounded-md border-2 border-brass/40 bg-navy/5 shadow-card-lg",
                "h-[60vh] min-h-[420px] lg:h-[calc(100dvh-220px)]"
              )}
            >
              <FenceMap
                handleRef={mapRef}
                centerLat={lat}
                centerLng={lng}
                onChange={setStats}
                gates={gates}
                gatePlacementMode={gateMode}
                onGatePointPicked={setPendingGatePoint}
                onGateMove={handleGateMove}
                onGateDelete={handleGateDelete}
                parcelBoundary={parcelBoundary}
                adjacentBoundaries={adjacentBoundaries}
              />

              {/* Top-left toolbar: mode toggle */}
              <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-2">
                <div className="pointer-events-auto flex overflow-hidden rounded-sm border border-navy/20 bg-navy/95 shadow-card-lg backdrop-blur">
                  <button
                    type="button"
                    onClick={() => {
                      setGateMode(false);
                      setPendingGatePoint(null);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 font-display text-[11px] font-semibold uppercase tracking-eyebrow transition-colors",
                      !gateMode
                        ? "bg-brass text-navy"
                        : "text-cream hover:bg-navy-soft"
                    )}
                    aria-pressed={!gateMode}
                  >
                    <Spline size={14} strokeWidth={2.5} />
                    {t.draw.toolFenceLine}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (stats.linear_feet === 0) return;
                      setGateMode((m) => !m);
                      setPendingGatePoint(null);
                    }}
                    disabled={stats.linear_feet === 0}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 font-display text-[11px] font-semibold uppercase tracking-eyebrow transition-colors",
                      "border-l border-navy-soft",
                      gateMode
                        ? "bg-brass text-navy"
                        : "text-cream hover:bg-navy-soft disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                    aria-pressed={gateMode}
                  >
                    <DoorOpen size={14} strokeWidth={2.5} />
                    {t.draw.toolAddGate}
                    {gates.length > 0 && (
                      <span className="ml-1 rounded-pill bg-brick px-1.5 text-[10px] font-bold text-cream">
                        {gates.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Top-right toolbar: undo / clear / help */}
              <div className="pointer-events-none absolute right-3 top-3 z-10 flex gap-2">
                <div className="pointer-events-auto flex overflow-hidden rounded-sm border border-navy/20 bg-navy/95 shadow-card-lg backdrop-blur">
                  <button
                    type="button"
                    onClick={() => mapRef.current?.undo()}
                    disabled={stats.linear_feet === 0}
                    className="flex items-center gap-1.5 px-3 py-2 font-display text-[11px] font-semibold uppercase tracking-eyebrow text-cream transition-colors hover:bg-navy-soft disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={t.draw.toolUndo}
                  >
                    <Undo2 size={14} strokeWidth={2.5} />
                    <span className="hidden sm:inline">{t.draw.toolUndo}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={stats.linear_feet === 0 && gates.length === 0}
                    className="flex items-center gap-1.5 border-l border-navy-soft px-3 py-2 font-display text-[11px] font-semibold uppercase tracking-eyebrow text-cream transition-colors hover:bg-navy-soft disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={t.draw.toolClear}
                  >
                    <RotateCcw size={14} strokeWidth={2.5} />
                    <span className="hidden sm:inline">{t.draw.toolClear}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHelpOpen(true)}
                    className="flex items-center gap-1.5 border-l border-navy-soft px-3 py-2 font-display text-[11px] font-semibold uppercase tracking-eyebrow text-cream transition-colors hover:bg-navy-soft"
                    aria-label={t.draw.toolHelp}
                  >
                    <HelpCircle size={14} strokeWidth={2.5} />
                    <span className="hidden sm:inline">{t.draw.toolHelp}</span>
                  </button>
                </div>
              </div>

              {/* Self-intersect banner — brick, centered top */}
              {crossesItself && (
                <div className="pointer-events-none absolute left-1/2 top-16 z-10 w-[90%] max-w-[420px] -translate-x-1/2 rounded-sm border border-brick bg-brick px-4 py-2 text-center text-[12px] font-semibold text-cream shadow-card-lg">
                  {t.draw.crossesItself}
                </div>
              )}

              {/* Empty-state hint */}
              {stats.linear_feet === 0 && !gateMode && (
                <div className="pointer-events-none absolute bottom-4 left-4 z-10 max-w-[300px] rounded-sm border border-brass/35 bg-navy/95 px-4 py-3 text-cream shadow-card-lg backdrop-blur">
                  <div className="font-mono text-[10px] uppercase tracking-spec text-brass">
                    {t.draw.emptyEyebrow}
                  </div>
                  <p className="mt-1 font-body text-[13px] leading-[1.45]">
                    {t.draw.emptyBody}
                  </p>
                </div>
              )}

              {/* Gate-mode floating hint */}
              {gateMode && !pendingGatePoint && (
                <div className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2 animate-pulse rounded-pill bg-brass px-5 py-2 font-display text-[12px] font-semibold uppercase tracking-eyebrow text-navy shadow-card-lg">
                  Tap the fence line to drop a gate
                </div>
              )}
            </div>
          </div>

          {/* ── Right panel ─────────────────────────────────────── */}
          <div className="order-3 lg:order-2">
            {/* Desktop intro — hidden on mobile because the mobile-only
                intro above the map already shows this content. */}
            <div className="hidden lg:block">
              <Eyebrow>{t.draw.eyebrow}</Eyebrow>
              <h2 className="mt-3 font-display text-[32px] font-bold uppercase leading-[1] tracking-[0.01em] text-navy md:text-[36px]">
                {t.draw.panelTitle}
              </h2>
              <p className="mt-3 max-w-[42ch] font-body text-[14px] leading-[1.55] text-char">
                {t.draw.panelHelp}
              </p>
            </div>

            {/* Live readout — first thing the mobile customer sees beneath
                the map; updates as they tap corners. */}
            <div className="grid grid-cols-3 gap-3 rounded-sm border border-navy/15 bg-cream px-4 py-4 lg:mt-6">
              <div>
                <div className="font-display text-[28px] font-bold leading-none tabular-nums tnum text-brick">
                  {stats.linear_feet.toFixed(0)}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-spec text-steel">
                  {t.draw.labelLF}
                </div>
              </div>
              <div>
                <div className="font-display text-[28px] font-bold leading-none tabular-nums tnum text-navy">
                  {gates.length}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-spec text-steel">
                  {t.draw.labelGates}
                </div>
              </div>
              <div>
                <div className="font-display text-[28px] font-bold leading-none tabular-nums tnum text-navy">
                  {stats.corner_count}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-spec text-steel">
                  {t.draw.labelCorners}
                </div>
                <div className="mt-0.5 font-body text-[10px] italic text-steel-soft">
                  {t.draw.livePostsHelper}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <SlopeSelfReport
                value={slopeCode}
                onChange={handleSlopeOverride}
                detected={detectedSlope}
                detecting={slopeDetecting}
              />
              <DemoToggle value={demoRequired} onChange={setDemoRequired} />

              {neighbors.length > 0 && <NeighborPanel neighbors={neighbors} />}

              {quoteId && (
                <PhotoUpload
                  quoteId={quoteId}
                  photos={photos}
                  onChange={setPhotos}
                  initialAudit={initialAudit}
                />
              )}
            </div>

            {error && (
              <div className="mt-4 rounded-sm border border-brick/30 bg-brick/5 px-3 py-2 text-sm text-brick">
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-4">
              <Link
                href={`/address/confirm?q=${quoteId ?? ""}`}
                className="flex items-center gap-2 font-display text-[13px] font-semibold uppercase tracking-eyebrow text-steel hover:text-navy"
              >
                <ArrowLeft size={14} strokeWidth={2.5} />
                {t.draw.backLink}
              </Link>
              <button
                type="button"
                onClick={handleContinue}
                disabled={!canContinue}
                className={cn(
                  "flex h-12 items-center gap-2 rounded-sm px-6 font-display text-[14px] font-semibold uppercase tracking-eyebrow transition-colors",
                  canContinue
                    ? "bg-brick text-cream hover:bg-brick-deep"
                    : "cursor-not-allowed bg-steel-soft text-cream"
                )}
              >
                {isPending ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <>
                    {t.draw.continueCtaShort}
                    <ArrowRight size={14} strokeWidth={2.5} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Gate-size bottom sheet (rendered outside map so it can overlay everything) */}
      {pendingGatePoint && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/20 bg-paper shadow-card-lg"
          role="dialog"
          aria-label="Choose gate size"
        >
          <div className="mx-auto max-w-2xl px-5 py-5 md:px-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-[16px] font-semibold uppercase tracking-eyebrow text-navy">
                  Pick A Gate Size
                </div>
                <div className="mt-0.5 font-body text-[12px] text-steel">
                  We&rsquo;ll drop it where you tapped.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingGatePoint(null)}
                aria-label="Cancel gate placement"
                className="rounded-pill p-1.5 text-steel hover:bg-navy/5 hover:text-navy"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {GATE_SIZES.map((s) => (
                <button
                  key={s.type}
                  type="button"
                  onClick={() => handlePickGateSize(s.type)}
                  className="flex flex-col items-center rounded-sm border border-navy/15 bg-paper px-3 py-3 transition-colors hover:border-brick hover:bg-brick/5"
                >
                  <Plus size={14} className="text-brick" strokeWidth={2.5} />
                  <span className="mt-0.5 font-display text-[18px] font-bold text-navy">
                    {s.label}
                  </span>
                  <span className="mt-0.5 font-mono text-[10px] uppercase tracking-spec text-steel">
                    {s.sublabel}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <DrawHelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t.draw.helpTitle}
        steps={t.draw.helpSteps}
        closeCta={t.draw.helpCloseCta}
        nextLabel={t.draw.helpNext}
        backLabel={t.draw.helpBack}
        stepLabel={t.draw.helpStepLabel}
      />
    </div>
  );
}

export default function DrawPage() {
  return (
    <Suspense fallback={null}>
      <DrawPageInner />
    </Suspense>
  );
}
