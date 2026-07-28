"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
  Suspense,
} from "react";
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
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  Undo2,
  Wand2,
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
import { MapErrorBoundary } from "@/components/map/MapErrorBoundary";
import {
  NeighborPanel,
  type NeighborSummary,
} from "@/components/draw/NeighborPanel";
import type { Direction } from "@/lib/integrations/regrid";
import type { GateType } from "@/lib/pricing/types";
import {
  cornerCount,
  isSelfIntersecting,
  uniquePostCount,
} from "@/lib/map/linear-feet";
import {
  chainLengthM,
  locateOnChain,
  sliceChainByLocation,
  traceFenceFromParcel,
} from "@/lib/map/trace-parcel";
import type { Position } from "geojson";
import { useT } from "@/lib/i18n/use-locale";
import { cn } from "@/lib/utils";
import { AimDrawOverlay } from "@/components/map/AimDrawOverlay";
import {
  drawReducer,
  EMPTY_DRAW_STATE,
  toFeature,
  totalLF,
  totalPosts,
  canFinish,
  canUndo,
} from "@/lib/map/draw-state";

const FenceMap = dynamic(() => import("@/components/map/FenceMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-navy/5">
      <Loader2 className="animate-spin text-navy/40" size={32} />
    </div>
  ),
});

// Stable no-op for FenceMap.onChange while aim mode owns stats (keeps gl-draw
// render-stats from clobbering the reducer-driven geometry).
const noopStats = () => {};

const GATE_SIZES: Array<{ type: GateType; label: string; sublabel: string }> = [
  { type: "W3", label: "3'", sublabel: "Walk" },
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
    vertex_count: 0,
  });
  const [slopeCode, setSlopeCode] = useState<number>(0);
  const [detectedSlope, setDetectedSlope] = useState<DetectedSlope | null>(null);
  const [slopeDetecting, setSlopeDetecting] = useState(false);
  const slopeUserOverrodeRef = useRef(false);
  const [demoRequired, setDemoRequired] = useState(false);
  const [gates, setGates] = useState<PlacedGate[]>([]);
  const [gateMode, setGateMode] = useState(false);
  const [pendingGatePoint, setPendingGatePoint] = useState<{ lat: number; lng: number } | null>(null);
  // Unified action history so Undo pops the most recent action regardless of
  // kind (fence vertex, placed gate, or a whole lot-line trace). Vertex
  // entries are inferred from stats changes; gate entries are pushed in
  // handlePickGateSize; "trace" is pushed as ONE atomic entry so a single
  // Undo removes the entire traced line.
  const [actionHistory, setActionHistory] = useState<
    Array<"vertex" | "gate" | "trace">
  >([]);
  const prevVertexCountRef = useRef(0);
  // Set just before a trace loads so the vertex-tracking effect doesn't
  // also spam N "vertex" entries for the traced points.
  const suppressVertexPushRef = useRef(false);
  // ── Endpoint trim state (post-trace) ──────────────────────────────
  // trimChain is the FULL traced chain kept as the slide rail; the live
  // fence is the slice of it between trimLocsRef.start/end (meters along
  // the chain). Handles can therefore shorten AND re-extend.
  const [trimChain, setTrimChain] = useState<Position[] | null>(null);
  const [trimHandles, setTrimHandles] = useState<
    Array<{ lat: number; lng: number }> | null
  >(null);
  const trimLocsRef = useRef({ start: 0, end: 0 });
  const trimTotalRef = useRef(0);
  const [photos, setPhotos] = useState<QuotePhoto[]>([]);
  const [initialAudit, setInitialAudit] = useState<PhotoAudit | null>(null);
  const [parcelBoundary, setParcelBoundary] = useState<ParcelBoundary | null>(null);
  const [neighbors, setNeighbors] = useState<NeighborSummary[]>([]);
  const [adjacentBoundaries, setAdjacentBoundaries] = useState<ParcelBoundary[]>([]);
  const [isPending, startTransition] = useTransition();
  const [helpOpen, setHelpOpen] = useState(false);

  // ─── Aim-and-drop (mobile / pointer:coarse) ──────────────────────────
  // Shared draw reducer is the source of truth; the map only renders it.
  const AIM_MIN_ZOOM = 18;
  const [aimMode, setAimMode] = useState(false);
  const [drawState, dispatch] = useReducer(drawReducer, EMPTY_DRAW_STATE);
  const [aimUiMode, setAimUiMode] = useState<"draw" | "adjust">("draw");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [tracedHelper, setTracedHelper] = useState(false);
  const [aimCenter, setAimCenter] = useState<[number, number] | null>(null);
  const [aimZoom, setAimZoom] = useState<number | null>(null);

  // Touch devices get aim mode; fine pointers keep the desktop draw. Set once.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    setAimMode(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const aimAiming = totalPosts(drawState) === 0;
  const aimZoomOk = aimZoom == null || aimZoom >= AIM_MIN_ZOOM;
  // Single run lives in `current` (no FINISH_LINE in aim mode); Finish is a UI
  // mode switch, not a reducer commit.
  const aimActiveCoords = drawState.current;
  const aimPreviewTo = useMemo(
    () =>
      aimUiMode === "draw" && aimActiveCoords.length >= 1 && aimZoomOk
        ? aimCenter
        : null,
    [aimUiMode, aimActiveCoords, aimZoomOk, aimCenter]
  );
  const aimTotalLf = totalLF(drawState);
  const [traceConfirm, setTraceConfirm] = useState(false);

  function handleMapMove(center: [number, number]) {
    setAimCenter(center);
    const z = mapRef.current?.getZoom();
    if (z != null) setAimZoom(z);
  }

  // Report the sheet height to the map so its centre = the visible-area centre
  // above the sheet (fixes reticle alignment + address/fitBounds centring).
  function handleSheetHeight(px: number) {
    mapRef.current?.setBottomPadding(px);
  }

  // Dev assert: the helper chip (bottom) and trace pill (top) occupy distinct
  // layout slots and must never overlap in any state — verified by geometry,
  // not z-order.
  useEffect(() => {
    if (!aimMode || process.env.NODE_ENV === "production") return;
    const id = setTimeout(() => {
      const h = document
        .querySelector('[data-aim-slot="helper"]')
        ?.getBoundingClientRect();
      const tr = document
        .querySelector('[data-aim-slot="trace"]')
        ?.getBoundingClientRect();
      if (!h || !tr) return;
      const clear =
        h.right < tr.left ||
        h.left > tr.right ||
        h.bottom < tr.top ||
        h.top > tr.bottom;
      if (!clear) {
        console.error(
          "[aim] helper chip and trace pill overlap — fix layout slots",
          { helper: h, trace: tr }
        );
      }
    }, 300);
    return () => clearTimeout(id);
  }, [aimMode, aimAiming, aimZoomOk, drawState]);

  function aimDrop() {
    // Unproject the reticle point (never raw getCenter) so what's under the
    // crosshair is exactly what lands.
    const c = mapRef.current?.getReticleCoord();
    if (!c || !aimZoomOk) return;
    if (process.env.NODE_ENV !== "production") {
      const gc = mapRef.current?.getMapCenter();
      if (gc && (Math.abs(gc[0] - c[0]) > 1e-6 || Math.abs(gc[1] - c[1]) > 1e-6)) {
        console.warn("[aim] reticle/center drift — check bottom padding", {
          reticle: c,
          paddedCenter: gc,
        });
      }
    }
    dispatch({ type: "DROP_POST", pos: c });
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
  }

  // Trace: seed the reducer with the parcel boundary as one drawing run, then
  // fit the camera. Lands in the normal draw stage so Undo/Drop/Finish work.
  function doAimTrace() {
    if (!parcelBoundary) return;
    const traced = traceFenceFromParcel(parcelBoundary, adjacentBoundaries);
    const geom = traced?.feature?.geometry;
    const coords =
      geom?.type === "LineString"
        ? geom.coordinates
        : geom?.type === "Polygon"
          ? geom.coordinates[0]
          : null;
    if (!coords || coords.length < 2) return;
    dispatch({
      type: "SET",
      state: { runs: [], current: coords as Position[] },
    });
    // Land in ADJUST so the customer drags corners to match their yard.
    setAimUiMode("adjust");
    setTracedHelper(true);
    mapRef.current?.fitToCoords(coords as number[][]);
  }
  function handleAimTraceClick() {
    if (!parcelBoundary) return;
    if (totalPosts(drawState) > 0) {
      setTraceConfirm(true);
      return;
    }
    doAimTrace();
  }
  function aimUndo() {
    dispatch({ type: "UNDO" });
  }
  // Finish is a mode switch — the run stays in `current` so Add Posts can keep
  // appending. No FINISH_LINE (that's for multi-run, a2).
  function aimFinish() {
    if (!canFinish(drawState)) return;
    setAimUiMode("adjust");
    setTracedHelper(false);
  }
  function aimStartOver() {
    dispatch({ type: "START_OVER" });
    setAimUiMode("draw");
    setTracedHelper(false);
  }
  function aimAddPosts() {
    setAimUiMode("draw");
    setTracedHelper(false);
  }
  function handlePostDrag(postIndex: number, coord: [number, number]) {
    dispatch({
      type: "MOVE_POST",
      runIndex: drawState.runs.length, // active run (single run lives in current)
      postIndex,
      coord,
    });
  }

  // Render the reducer geometry to the map layer as it changes / as the map
  // pans under the reticle.
  useEffect(() => {
    if (!aimMode) return;
    mapRef.current?.setAimGeometry(aimActiveCoords, aimPreviewTo);
  }, [aimMode, aimActiveCoords, aimPreviewTo]);

  // Bridge the committed drawing into the existing stats/save pipeline. Now
  // multi-run (a2): toFeature emits a LineString (one run) or MultiLineString
  // (branches / disconnected sections); geometryLF, save, engine, admin + PDF
  // all handle both. Metrics dedupe shared junction coords.
  useEffect(() => {
    if (!aimMode) return;
    const feature = toFeature(drawState);
    if (feature) {
      setStats({
        feature,
        linear_feet: aimTotalLf,
        corner_count: cornerCount(feature),
        closed: false,
        vertex_count: uniquePostCount(feature),
      });
    } else {
      setStats({
        feature: null,
        linear_feet: 0,
        corner_count: 0,
        closed: false,
        vertex_count: 0,
      });
    }
    // aimTotalLf derives from drawState; deliberately keyed on drawState only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aimMode, drawState]);
  // One-time "Tap a corner to begin" coachmark — shows on first visit until
  // the user taps anywhere on the map (= first vertex placed) or hits Help,
  // then never reappears in the session. Replaces the persistent
  // "Tap To Start" card that used to live in the map's bottom-left corner.
  const [coachmarkVisible, setCoachmarkVisible] = useState(true);

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

  // Dismiss the coachmark the moment the first vertex lands. It's a one-shot
  // nudge — the user has demonstrated they understand the gesture.
  useEffect(() => {
    if (stats.linear_feet > 0 && coachmarkVisible) {
      setCoachmarkVisible(false);
    }
  }, [stats.linear_feet, coachmarkVisible]);

  // Track vertex additions for the unified undo stack. Drives off
  // `stats.vertex_count` which FenceMap computes with the phantom
  // cursor-follower already excluded — so toggling gate mode (which adds
  // / removes that phantom from raw coords) no longer triggers spurious
  // "vertex" pushes that would shadow the most recent "gate" entry.
  // Two extra guards: a trace pushes ONE "trace" entry instead of N
  // vertices (suppress flag), and endpoint trim drags change the count
  // continuously without being undoable actions of their own.
  useEffect(() => {
    const vc = stats.vertex_count;
    if (vc > prevVertexCountRef.current) {
      if (suppressVertexPushRef.current || trimChain) {
        suppressVertexPushRef.current = false;
      } else {
        const added = vc - prevVertexCountRef.current;
        setActionHistory((h) => [...h, ...Array<"vertex">(added).fill("vertex")]);
      }
    }
    prevVertexCountRef.current = vc;
  }, [stats.vertex_count, trimChain]);

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
    setStats({ feature: null, linear_feet: 0, corner_count: 0, closed: false, vertex_count: 0 });
    setGates([]);
    setGateMode(false);
    setPendingGatePoint(null);
    setDetectedSlope(null);
    setActionHistory([]);
    setTrimChain(null);
    setTrimHandles(null);
    suppressVertexPushRef.current = false;
    prevVertexCountRef.current = 0;
    slopeUserOverrodeRef.current = false;
    mapRef.current?.reset();
  }

  function handlePickGateSize(type: GateType) {
    if (!pendingGatePoint) return;
    setGates((prev) => [...prev, { type, count: 1, position: pendingGatePoint }]);
    setActionHistory((h) => [...h, "gate"]);
    setPendingGatePoint(null);
  }

  // Unified undo — pops the most recent action regardless of kind. Gate
  // undos remove the last placed gate; vertex undos delegate to the map;
  // a "trace" undo removes the entire traced line (and any active trim
  // handles) in one step.
  function handleUndo() {
    const last = actionHistory[actionHistory.length - 1];
    if (!last) return;
    setActionHistory((h) => h.slice(0, -1));
    if (last === "gate") {
      setGates((prev) => prev.slice(0, -1));
    } else if (last === "trace") {
      setTrimChain(null);
      setTrimHandles(null);
      mapRef.current?.reset();
    } else {
      mapRef.current?.undo();
    }
  }

  function handleGateMove(index: number, position: { lat: number; lng: number }) {
    setGates((prev) => prev.map((g, i) => (i === index ? { ...g, position } : g)));
  }

  function handleGateDelete(index: number) {
    setGates((prev) => prev.filter((_, i) => i !== index));
  }

  // One-tap lot-line trace — converts the Regrid parcel boundary into a
  // pre-drawn fence (rear + sides when neighbor data identifies the
  // street frontage; full perimeter otherwise). LineString traces enter
  // trim mode: the line renders in an inert mode with a big draggable
  // handle on each end that SLIDES ALONG THE LOT LINE, so the customer
  // pulls each side back from the street corner to where the fence
  // actually cuts in at the house. One "trace" entry lands in the undo
  // stack — Undo removes the whole trace atomically.
  function handleTraceLot() {
    if (!parcelBoundary) return;
    const traced = traceFenceFromParcel(parcelBoundary, adjacentBoundaries);
    if (!traced) return;
    suppressVertexPushRef.current = true;
    setActionHistory((h) => [...h, "trace"]);
    setCoachmarkVisible(false);
    if (traced.feature.geometry.type === "LineString") {
      const chain = traced.feature.geometry.coordinates as Position[];
      mapRef.current?.loadFeatureStatic(traced.feature);
      const total = chainLengthM(chain);
      setTrimChain(chain);
      trimLocsRef.current = { start: 0, end: total };
      trimTotalRef.current = total;
      setTrimHandles([
        { lat: chain[0][1], lng: chain[0][0] },
        { lat: chain[chain.length - 1][1], lng: chain[chain.length - 1][0] },
      ]);
    } else {
      // Polygon fallback (full perimeter) — no endpoints to trim.
      mapRef.current?.loadFeature(traced.feature);
    }
  }

  // Endpoint handle drag — snap the raw finger position onto the traced
  // chain, clamp against the opposite end (min 3m of fence), and rewrite
  // the live line to the slice between the two locations. The fence stays
  // magnetized to the lot line no matter where the finger wanders; LF in
  // the readout and sticky bar stream live during the drag.
  function handleTrimDrag(
    index: number,
    pos: { lat: number; lng: number },
    phase: "move" | "end"
  ) {
    if (!trimChain) return;
    const MIN_GAP_M = 3;
    const loc = locateOnChain(trimChain, [pos.lng, pos.lat]);
    let { start, end } = trimLocsRef.current;
    if (index === 0) {
      start = Math.max(0, Math.min(loc.locationM, end - MIN_GAP_M));
    } else {
      end = Math.min(
        trimTotalRef.current,
        Math.max(loc.locationM, start + MIN_GAP_M)
      );
    }
    trimLocsRef.current = { start, end };
    const coords = sliceChainByLocation(trimChain, start, end);
    mapRef.current?.setFeatureCoords(coords as number[][]);
    if (phase === "end") {
      // Re-seat the handles exactly on the trimmed endpoints (the dot
      // may have been dropped off-line; the line itself never left).
      setTrimHandles([
        { lat: coords[0][1], lng: coords[0][0] },
        {
          lat: coords[coords.length - 1][1],
          lng: coords[coords.length - 1][0],
        },
      ]);
    }
  }

  // Exit trim mode, keeping the trimmed line, and hand control back to
  // normal drawing (next tap extends from the end).
  function exitTrimMode(resume: boolean) {
    setTrimChain(null);
    setTrimHandles(null);
    if (resume) mapRef.current?.resumeLine();
  }

  const crossesItself = useMemo(
    () => (stats.feature ? isSelfIntersecting(stats.feature) : false),
    [stats.feature]
  );

  function handleContinue() {
    if (!quoteId || !stats.feature) return;
    // Pull the phantom-stripped geometry straight from the map. The live
    // stats feature includes gl-draw's rubber-band cursor point while in
    // a draw mode — on desktop that point sits wherever the mouse last
    // touched the map, silently inflating the saved linear feet.
    const final = mapRef.current?.getFinalFeature();
    const feature = final?.feature ?? stats.feature;
    const linearFeet = final?.linear_feet ?? stats.linear_feet;
    const corners = final?.corner_count ?? stats.corner_count;
    if (linearFeet < 5) {
      setError(t.draw.needFenceLine);
      return;
    }
    if (isSelfIntersecting(feature)) {
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
            geometry: feature,
            linear_feet: linearFeet,
            corner_count: corners,
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
  const detailsBadge = (demoRequired ? 1 : 0) + photos.length;

  // Slope / demo / neighbors / photos — shown in the right column on desktop
  // and (on aim/touch) inside the Details drawer so the draw screen stays
  // full-viewport. Same components/state either way.
  const detailsInputs = (
    <div className="space-y-4">
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
  );

  return (
    <div
      className={cn(
        "flex flex-col bg-paper",
        aimMode
          ? "h-dvh overflow-hidden pb-0"
          : "min-h-dvh pb-20 lg:pb-0"
      )}
    >
      <Header dark />
      <Progress step={2} dark />

      <section className={cn("flex-1", aimMode && "flex min-h-0 flex-col")}>
        <div
          className={
            aimMode
              ? "mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-2 px-3 pb-2 pt-1 min-h-0"
              : "mx-auto grid max-w-[1280px] gap-6 px-5 py-6 md:px-10 md:py-10 lg:grid-cols-[1fr_360px]"
          }
        >
          {/* Aim/touch: collapse the heading block to one thin row — the
              on-map helper chip already says what to do. */}
          {aimMode ? (
            <div className="order-1 lg:hidden">
              <Eyebrow>{t.draw.aimStepRow}</Eyebrow>
            </div>
          ) : (
          <div className="order-1 lg:hidden">
            <Eyebrow>{t.draw.eyebrow}</Eyebrow>
            <h2 className="mt-3 font-display text-[26px] font-bold uppercase leading-[1.05] tracking-[0.01em] text-navy">
              {t.draw.panelTitle}
            </h2>
            <p className="mt-2 font-body text-[14px] leading-[1.5] text-char">
              {t.draw.panelHelp}
            </p>
          </div>
          )}

          {/* ── Map column — three zones top-to-bottom on mobile:
                Zone 2 mode toggle / Zone 3 map / Zone 4 action bar.
                The map itself stays clean — no floating chrome competing
                with the satellite or covering parcel labels. ──────── */}
          <div
            className={cn(
              "order-2 lg:order-1",
              aimMode && "flex min-h-0 flex-1 flex-col"
            )}
          >
            {/* Zone 2 — Mode toggle (above map, full-width 50/50 split).
                Two items only, so ADD GATE can never clip. */}
            <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-sm border border-navy/25 bg-paper shadow-card">
              <button
                type="button"
                onClick={() => {
                  setGateMode(false);
                  setPendingGatePoint(null);
                  // Tapping Fence Line while trim handles are up commits
                  // the trim and returns to drawing (next tap extends).
                  if (trimChain) exitTrimMode(true);
                }}
                className={cn(
                  "flex h-12 items-center justify-center gap-2 font-display text-[13px] font-semibold uppercase tracking-eyebrow transition-colors",
                  !gateMode
                    ? "bg-navy text-cream"
                    : "text-navy hover:bg-navy/5"
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
                  // Commit any active trim before gate placement — the
                  // gate effect owns mode switching from here, and its
                  // exit path resumes line drawing as usual.
                  if (trimChain) exitTrimMode(false);
                  setGateMode((m) => !m);
                  setPendingGatePoint(null);
                }}
                disabled={stats.linear_feet === 0}
                className={cn(
                  "flex h-12 items-center justify-center gap-2 border-l border-navy/25 font-display text-[13px] font-semibold uppercase tracking-eyebrow transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  gateMode
                    ? "bg-brick text-cream"
                    : "text-navy hover:bg-navy/5"
                )}
                aria-pressed={gateMode}
              >
                <DoorOpen size={14} strokeWidth={2.5} />
                {t.draw.toolAddGate}
                {gates.length > 0 && (
                  <span className="ml-1 rounded-pill bg-brass px-1.5 text-[10px] font-bold text-navy">
                    {gates.length}
                  </span>
                )}
              </button>
            </div>

            {/* Zone 3 — Map (satellite + drawing only). Single zoom control
                lives in the map's bottom-right via FenceMap; nothing else
                floats. Overlays here are limited to: one-time coachmark,
                gate-mode pulse, and the bottom-pinned error banner. */}
            <div
              className={cn(
                "relative overflow-hidden rounded-md border-2 border-brass/40 bg-navy/5 shadow-card-lg",
                aimMode
                  ? "min-h-0 flex-1"
                  : "h-[60vh] min-h-[420px] lg:h-[calc(100dvh-280px)]"
              )}
            >
              <MapErrorBoundary>
                <FenceMap
                  handleRef={mapRef}
                  centerLat={lat}
                  centerLng={lng}
                  onChange={aimMode ? noopStats : setStats}
                  aimMode={aimMode}
                  adjustMode={aimMode && aimUiMode === "adjust"}
                  onPostDrag={handlePostDrag}
                  onMapMove={aimMode ? handleMapMove : undefined}
                  gates={gates}
                  gatePlacementMode={gateMode}
                  onGatePointPicked={setPendingGatePoint}
                  onGateMove={handleGateMove}
                  onGateDelete={handleGateDelete}
                  parcelBoundary={parcelBoundary}
                  adjacentBoundaries={adjacentBoundaries}
                  trimHandles={trimHandles}
                  onTrimHandleDrag={handleTrimDrag}
                />
              </MapErrorBoundary>

              <AimDrawOverlay
                active={aimMode && !detailsOpen}
                stage={aimUiMode}
                aiming={aimAiming}
                canUndo={canUndo(drawState)}
                canFinish={canFinish(drawState)}
                zoomOk={aimZoomOk}
                adjustHelper={
                  tracedHelper
                    ? t.draw.aimTraceAdjustHelper
                    : t.draw.aimAdjustHelper
                }
                t={t}
                onDrop={aimDrop}
                onUndo={aimUndo}
                onFinish={aimFinish}
                onStartOver={aimStartOver}
                onAddPosts={aimAddPosts}
                onSheetHeight={handleSheetHeight}
              />

              {/* Aim mode: trace pill (top-right, under the address bar) +
                  a small Help chip (bottom-left, by the map controls). */}
              {aimMode && parcelBoundary && !gateMode && (
                <button
                  type="button"
                  data-aim-slot="trace"
                  onClick={handleAimTraceClick}
                  className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-pill bg-navy/95 px-3.5 py-2 font-display text-[11px] font-semibold uppercase tracking-eyebrow text-cream shadow-card-lg backdrop-blur transition-colors hover:bg-navy"
                >
                  <Sparkles size={13} strokeWidth={2.5} className="text-brass" />
                  {t.draw.aimTracePill}
                </button>
              )}
              {aimMode && (
                <button
                  type="button"
                  aria-label={t.draw.toolHelp}
                  onClick={() => setHelpOpen(true)}
                  className="absolute bottom-3 left-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-navy/95 text-cream shadow-card-lg backdrop-blur transition-colors hover:bg-navy"
                >
                  <HelpCircle size={16} strokeWidth={2.5} />
                </button>
              )}

              {/* Replace-drawing confirm before tracing over existing work. */}
              {aimMode && traceConfirm && (
                <div className="absolute inset-0 z-40 flex items-end bg-navy/40">
                  <div className="w-full rounded-t-[18px] border-t border-cream-deep bg-paper px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-5 shadow-card-lg">
                    <p className="text-center font-display text-[16px] font-semibold uppercase tracking-eyebrow text-navy">
                      {t.draw.aimTraceReplaceTitle}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTraceConfirm(false)}
                        className="h-12 flex-1 rounded-sm border border-navy/25 font-display text-[13px] font-semibold uppercase tracking-eyebrow text-navy transition-colors hover:bg-navy/5"
                      >
                        {t.draw.aimTraceReplaceCancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTraceConfirm(false);
                          doAimTrace();
                        }}
                        className="h-12 flex-1 rounded-sm bg-brick font-display text-[13px] font-semibold uppercase tracking-eyebrow text-cream transition-colors hover:bg-brick-deep"
                      >
                        {t.draw.aimTraceReplaceConfirm}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* One-time coachmark — slim pill, dismisses on first vertex. */}
              {!aimMode && coachmarkVisible && stats.linear_feet === 0 && !gateMode && (
                <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-pill border border-brass/50 bg-navy/95 px-4 py-1.5 shadow-card-lg backdrop-blur">
                  <span className="font-display text-[11px] font-semibold uppercase tracking-eyebrow text-cream">
                    {t.draw.emptyEyebrow} ·{" "}
                  </span>
                  <span className="font-body text-[12px] text-cream/85">
                    Tap a corner to begin
                  </span>
                </div>
              )}

              {/* Trim-mode hint — slim pill at top while endpoint handles
                  are live. Done commits the trim and resumes drawing. */}
              {trimChain && !gateMode && (
                <div className="absolute left-1/2 top-3 z-10 flex max-w-[94%] -translate-x-1/2 items-center gap-2.5 rounded-pill border border-brass/50 bg-navy/95 py-1.5 pl-4 pr-1.5 shadow-card-lg backdrop-blur">
                  <span className="truncate font-body text-[12px] text-cream/90">
                    {t.draw.traceAdjustHint}
                  </span>
                  <button
                    type="button"
                    onClick={() => exitTrimMode(true)}
                    className="flex-shrink-0 rounded-pill bg-brass px-3.5 py-1.5 font-display text-[11px] font-semibold uppercase tracking-eyebrow text-navy transition-colors hover:bg-brass/85"
                  >
                    {t.draw.traceAdjustDone}
                  </button>
                </div>
              )}

              {/* One-tap lot-line trace — only before anything is drawn,
                  only when Regrid gave us a boundary. Bottom-center so it
                  doesn't fight the coachmark pill at top or the zoom
                  control bottom-right. Disappears on first vertex. */}
              {parcelBoundary && stats.linear_feet === 0 && !gateMode && (
                <button
                  type="button"
                  onClick={handleTraceLot}
                  className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-pill border border-brass/60 bg-navy/95 px-5 py-2.5 font-display text-[12px] font-semibold uppercase tracking-eyebrow text-cream shadow-card-lg backdrop-blur transition-colors hover:bg-navy"
                >
                  <Wand2 size={14} strokeWidth={2.5} className="text-brass" />
                  {t.draw.traceLotCta}
                </button>
              )}

              {/* Gate-mode pulse — only while picking, slim pill at top. */}
              {gateMode && !pendingGatePoint && (
                <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 animate-pulse rounded-pill bg-brass px-5 py-2 font-display text-[12px] font-semibold uppercase tracking-eyebrow text-navy shadow-card-lg">
                  Tap the fence line to drop a gate
                </div>
              )}

              {/* Self-intersect banner — pinned to the map's BOTTOM edge so
                  it never covers the mode toggle or controls. Inline
                  "Undo Last Corner" button so the fix lives in the same
                  place as the error. */}
              {crossesItself && (
                <div className="absolute bottom-3 left-1/2 z-10 flex w-[92%] max-w-[460px] -translate-x-1/2 items-center justify-between gap-3 rounded-sm border border-brick bg-brick px-3 py-2 text-cream shadow-card-lg">
                  <div className="flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-eyebrow">
                    <TriangleAlert size={14} strokeWidth={2.5} className="flex-shrink-0" />
                    <span className="truncate">{t.draw.crossesItself}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="flex h-8 flex-shrink-0 items-center gap-1.5 rounded-sm bg-cream px-3 font-display text-[11px] font-semibold uppercase tracking-eyebrow text-brick transition-colors hover:bg-paper"
                  >
                    <Undo2 size={12} strokeWidth={2.5} />
                    Undo
                  </button>
                </div>
              )}
            </div>

            {/* Zone 4 — Action bar (below map). Undo · Clear All · Help.
                Desktop only — aim mode consolidates these into the sheet
                (Undo/Finish/Start over) + the on-map Help chip. */}
            <div className={cn("mt-3 grid grid-cols-3 gap-2", aimMode && "hidden")}>
              <button
                type="button"
                onClick={handleUndo}
                disabled={actionHistory.length === 0}
                className="flex h-12 items-center justify-center gap-2 rounded-sm border border-navy/25 bg-paper font-display text-[12px] font-semibold uppercase tracking-eyebrow text-navy transition-colors hover:border-navy hover:bg-navy/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Undo2 size={14} strokeWidth={2.5} />
                {t.draw.toolUndo}
              </button>
              {/* Clear is the universal escape hatch — always enabled, even
                  when stats report nothing. If draw state has gotten
                  corrupted, the user can still nuke it without refreshing. */}
              <button
                type="button"
                onClick={handleReset}
                className={cn(
                  "flex h-12 items-center justify-center gap-2 rounded-sm border font-display text-[12px] font-semibold uppercase tracking-eyebrow transition-colors",
                  stats.linear_feet > 0 || gates.length > 0
                    ? "border-brick bg-brick text-cream hover:bg-brick-deep"
                    : "border-navy/25 bg-paper text-navy hover:border-navy hover:bg-navy/5"
                )}
              >
                <RotateCcw size={14} strokeWidth={2.5} />
                {t.draw.toolClear}
              </button>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="flex h-12 items-center justify-center gap-2 rounded-sm border border-navy/25 bg-paper font-display text-[12px] font-semibold uppercase tracking-eyebrow text-navy transition-colors hover:border-navy hover:bg-navy/5"
              >
                <HelpCircle size={14} strokeWidth={2.5} />
                {t.draw.toolHelp}
              </button>
            </div>
          </div>

          {/* ── Right panel ─────────────────────────────────────── */}
          <div
            className={cn(
              "order-3 lg:order-2",
              aimMode && "hidden lg:block"
            )}
          >
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

            <div className="mt-6">{detailsInputs}</div>

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

      {/* Sticky mobile CTA — live readout + Continue pinned to the bottom
          so the customer never has to scroll past photos/slope to advance.
          Hidden on lg where the right-column CTA is always visible.
          z-30 keeps it BELOW the gate-size sheet (z-40), which should
          cover it while a gate is being picked. */}
      <div
        className={cn(
          "border-t border-navy/15 bg-paper/95 backdrop-blur",
          aimMode
            ? "relative z-20 shrink-0"
            : "fixed inset-x-0 bottom-0 z-30 lg:hidden"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-2.5">
          <div className="min-w-0">
            <div className="font-display text-[20px] font-bold leading-none tabular-nums text-navy">
              {stats.linear_feet.toFixed(0)}{" "}
              <span className="font-mono text-[10px] font-normal uppercase tracking-spec text-steel">
                {t.draw.labelLF}
              </span>
            </div>
            <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-spec text-steel">
              {gates.length} {t.draw.labelGates} · {stats.corner_count}{" "}
              {t.draw.labelCorners}
              {/* Tear-out changes the price — surface it even when its input is
                  hidden in the Details drawer. */}
              {demoRequired && (
                <span className="text-brick"> · {t.draw.aimDetailsDemo} ✓</span>
              )}
            </div>
          </div>

          {/* Details drawer trigger — badge so hidden inputs are never silently
              forgotten. */}
          {aimMode && (
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="relative flex h-11 flex-shrink-0 items-center gap-1.5 rounded-sm border border-navy/25 px-3.5 font-display text-[12px] font-semibold uppercase tracking-eyebrow text-navy transition-colors hover:bg-navy/5"
            >
              <SlidersHorizontal size={14} strokeWidth={2.5} />
              {t.draw.aimDetails}
              {detailsBadge > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brick px-1 font-mono text-[9px] text-cream">
                  {detailsBadge}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            className={cn(
              "flex h-12 flex-shrink-0 items-center gap-2 rounded-sm px-6 font-display text-[14px] font-semibold uppercase tracking-eyebrow transition-colors",
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

      {/* Details drawer (aim/touch) — slope / demo / neighbors / photos. Opens
          over the map; the draw control sheet is hidden while it's open (one
          sheet at a time). Dismisses by tap-out or Close. */}
      {aimMode && detailsOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-navy/40"
          onClick={() => setDetailsOpen(false)}
        >
          <div
            className="max-h-[80dvh] w-full overflow-y-auto rounded-t-[18px] border-t border-cream-deep bg-paper px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-3 shadow-card-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={t.draw.aimDetailsTitle}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-navy/15" />
            <div className="mb-3 flex items-center justify-between">
              <div className="font-display text-[15px] font-semibold uppercase tracking-eyebrow text-navy">
                {t.draw.aimDetailsTitle}
              </div>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-navy transition-colors hover:bg-navy/5"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            {detailsInputs}
          </div>
        </div>
      )}

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
