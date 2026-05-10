"use client";

import { useEffect, useRef, useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  RotateCcw,
  Square,
  Spline,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressDots } from "@/components/ProgressDots";
import { DrawingHud } from "@/components/map/DrawingHud";
import { SlopeSelfReport } from "@/components/map/SlopeSelfReport";
import { DemoToggle } from "@/components/map/DemoToggle";
import { GatePlacer } from "@/components/map/GatePlacer";
import type {
  FenceGeometryStats,
  FenceMapHandle,
  PlacedGate,
} from "@/components/map/FenceMap";
import type { GateType } from "@/lib/pricing/types";

// Mapbox accesses window at module load — must be client-only
const FenceMap = dynamic(() => import("@/components/map/FenceMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-navy/5">
      <Loader2 className="animate-spin text-navy/40" size={32} />
    </div>
  ),
});

interface QuoteShape {
  id: string;
  lat: string | number | null;
  lng: string | number | null;
  addressLine: string | null;
  zip: string | null;
}

function DrawPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("q");

  const [quote, setQuote] = useState<QuoteShape | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<FenceGeometryStats>({
    feature: null,
    linear_feet: 0,
    corner_count: 0,
    closed: false,
  });
  const [slopeCode, setSlopeCode] = useState<0 | 2>(0);
  const [demoRequired, setDemoRequired] = useState(false);
  const [drawMode, setDrawMode] = useState<"line" | "polygon">("line");
  const [gates, setGates] = useState<PlacedGate[]>([]);
  const [gateMode, setGateMode] = useState(false);
  const [pendingGatePoint, setPendingGatePoint] = useState<{ lat: number; lng: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  const mapRef = useRef<FenceMapHandle>(null);

  useEffect(() => {
    if (!quoteId) {
      setError("Missing quote id — start over from the address page.");
      return;
    }
    let cancelled = false;
    fetch(`/api/v1/quotes/${quoteId}`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Could not load quote (${r.status})`);
        return r.json();
      })
      .then((q) => {
        if (cancelled) return;
        if (q?.lat == null || q?.lng == null) {
          throw new Error("Quote is missing coordinates.");
        }
        setQuote(q);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      });
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  function handleSetMode(mode: "line" | "polygon") {
    setDrawMode(mode);
    mapRef.current?.setMode(mode);
  }

  function handleReset() {
    setStats({ feature: null, linear_feet: 0, corner_count: 0, closed: false });
    setGates([]);
    setGateMode(false);
    setPendingGatePoint(null);
    mapRef.current?.reset();
  }

  function handlePickGateSize(type: GateType) {
    if (!pendingGatePoint) return;
    setGates((prev) => [...prev, { type, count: 1, position: pendingGatePoint }]);
    setPendingGatePoint(null);
    setGateMode(false);
  }

  function handleContinue() {
    if (!quoteId || !stats.feature) return;
    if (stats.linear_feet < 5) {
      setError("Draw a fence line first — tap each corner on the map.");
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
            slope_self_reported: true,
            demo_required: demoRequired,
            demo_type: demoRequired ? "CEDAR" : "NONE", // refined in Screen 4
            gates,
          }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? "Could not save your fence");
        }
        router.push(`/configure?q=${quoteId}`);
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

  if (!quote) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-6">
        <Loader2 className="animate-spin text-navy/40" size={32} />
        <p className="mt-3 text-sm text-navy/60">Loading your map…</p>
      </main>
    );
  }

  const lat = Number(quote.lat);
  const lng = Number(quote.lng);

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      {/* Top bar — progress + address */}
      <header className="z-10 border-b border-navy/10 bg-white px-4 py-2">
        <ProgressDots current="draw" />
        {quote.addressLine && (
          <div className="text-center text-xs text-navy/50">
            {quote.addressLine}
          </div>
        )}
      </header>

      {/* Map area — flexes to fill, with explicit fallback height so the
          inner Mapbox canvas can never see 0px even if the flex layout is
          still settling at mount. */}
      <div
        className="relative flex-1"
        style={{ height: "60vh", minHeight: 420 }}
      >
        <FenceMap
          handleRef={mapRef}
          centerLat={lat}
          centerLng={lng}
          onChange={setStats}
          gates={gates}
          gatePlacementMode={gateMode}
          onGatePointPicked={setPendingGatePoint}
        />

        {/* HUD overlay (top center) */}
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full overflow-hidden">
          <DrawingHud
            linearFeet={stats.linear_feet}
            cornerCount={stats.corner_count}
          />
        </div>

        {/* Help (bottom-left, small) */}
        {stats.linear_feet === 0 && (
          <div className="pointer-events-none absolute bottom-4 left-4 max-w-xs rounded-lg bg-navy/90 px-3 py-2 text-xs text-white shadow-lg">
            Tap each corner where you want fence. Tap the first point again to
            close, or hit <span className="font-semibold">Continue</span> with
            an open line.
          </div>
        )}
      </div>

      {/* Bottom action panel */}
      <section className="border-t border-navy/10 bg-white px-4 pb-6 pt-4 sm:px-6">
        {/* Draw-mode toggle + reset */}
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSetMode("line")}
            className={
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors " +
              (drawMode === "line"
                ? "border-accent bg-accent/10 text-navy"
                : "border-navy/15 bg-white text-navy/70")
            }
            aria-pressed={drawMode === "line"}
          >
            <Spline size={16} /> Line
          </button>
          <button
            type="button"
            onClick={() => handleSetMode("polygon")}
            className={
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors " +
              (drawMode === "polygon"
                ? "border-accent bg-accent/10 text-navy"
                : "border-navy/15 bg-white text-navy/70")
            }
            aria-pressed={drawMode === "polygon"}
          >
            <Square size={16} /> Closed
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm font-semibold text-navy/70 hover:border-navy/30"
            aria-label="Reset drawing"
          >
            <RotateCcw size={16} /> Reset
          </button>
        </div>

        <div className="mb-4">
          <GatePlacer
            lineExists={stats.linear_feet > 0}
            placementMode={gateMode}
            pendingPoint={pendingGatePoint}
            gateCount={gates.length}
            onEnter={() => setGateMode(true)}
            onCancelMode={() => {
              setGateMode(false);
              setPendingGatePoint(null);
            }}
            onPickSize={handlePickGateSize}
            onCancelSize={() => setPendingGatePoint(null)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SlopeSelfReport value={slopeCode} onChange={setSlopeCode} />
          <DemoToggle value={demoRequired} onChange={setDemoRequired} />
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
          </div>
        )}

        <Button
          type="button"
          size="lg"
          className="mt-4 w-full"
          onClick={handleContinue}
          disabled={!stats.feature || stats.linear_feet < 5 || isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" size={20} /> Saving…
            </>
          ) : (
            <>
              Continue with {stats.linear_feet.toFixed(0)} LF{" "}
              <ArrowRight size={20} />
            </>
          )}
        </Button>
      </section>
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
