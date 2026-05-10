"use client";

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import type { Feature, LineString, Polygon } from "geojson";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import { lineString as turfLineString, point as turfPoint } from "@turf/helpers";
import {
  GATE_MARKER_CLASS,
  GATE_SNAP_MAX_KM,
  MAP_DEFAULTS,
  SATELLITE_STYLE,
  fenceDrawStyles,
} from "@/lib/map/draw-config";
import { cornerCount, geometryLF } from "@/lib/map/linear-feet";
import type { GateType } from "@/lib/pricing/types";

export interface PlacedGate {
  type: GateType;
  count: number;
  position: { lat: number; lng: number };
}

export interface FenceGeometryStats {
  feature: Feature<LineString | Polygon> | null;
  linear_feet: number;
  corner_count: number;
  closed: boolean;
}

export interface FenceMapHandle {
  reset(): void;
  undo(): void;
  setMode(mode: "line" | "polygon"): void;
}

interface Props {
  centerLat: number;
  centerLng: number;
  onChange: (stats: FenceGeometryStats) => void;
  // Ref passed as a regular prop because next/dynamic's LoadableComponent
  // wrapper doesn't forward refs from React.forwardRef through.
  handleRef?:
    | RefObject<FenceMapHandle | null>
    | MutableRefObject<FenceMapHandle | null>;
  // Gate placement (Phase 1)
  gates?: PlacedGate[];
  gatePlacementMode?: boolean;
  onGatePointPicked?: (point: { lat: number; lng: number }) => void;
}

const GATE_WIDTH_LABEL: Record<GateType, string> = {
  "SW-4": "4'",
  "SW-5": "5'",
  "DD-10": "10'",
  "DD-12": "12'",
  "DD-14": "14'",
};

function makeGateMarkerEl(type: GateType): HTMLDivElement {
  const el = document.createElement("div");
  el.className = GATE_MARKER_CLASS;
  el.textContent = GATE_WIDTH_LABEL[type];
  el.setAttribute("aria-label", `Gate: ${GATE_WIDTH_LABEL[type]} ${type}`);
  return el;
}

export default function FenceMap({
  centerLat,
  centerLng,
  onChange,
  handleRef,
  gates,
  gatePlacementMode,
  onGatePointPicked,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onGatePointPickedRef = useRef(onGatePointPicked);
  onGatePointPickedRef.current = onGatePointPicked;
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      const msg = "NEXT_PUBLIC_MAPBOX_TOKEN is not set in .env.local";
      console.error("[FenceMap]", msg);
      setErrorMsg(msg);
      return;
    }
    mapboxgl.accessToken = token;

    // Diagnostic: log container dimensions before init. If width or height is
    // 0 at this point, Mapbox renders to a zero-pixel canvas and silently
    // skips tile fetches — which is exactly the symptom of a "loaded but
    // blank" map.
    const rect = containerRef.current.getBoundingClientRect();
    console.info(
      `[FenceMap] container size at init: ${rect.width.toFixed(0)} × ${rect.height.toFixed(0)}`
    );
    if (rect.width < 10 || rect.height < 10) {
      console.warn(
        "[FenceMap] container is near-zero — map will be blank. Parent layout may not have settled."
      );
    }

    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: SATELLITE_STYLE,
        center: [centerLng, centerLat],
        zoom: MAP_DEFAULTS.zoom,
        minZoom: MAP_DEFAULTS.minZoom,
        maxZoom: MAP_DEFAULTS.maxZoom,
        pitch: MAP_DEFAULTS.pitch,
        bearing: MAP_DEFAULTS.bearing,
        maxPitch: 0,
        pitchWithRotate: MAP_DEFAULTS.pitchWithRotate,
        dragRotate: MAP_DEFAULTS.dragRotate,
        attributionControl: false,
        antialias: false,           // perf: software AA off
        fadeDuration: 0,             // no tile cross-fade animation
        preserveDrawingBuffer: false,
      });
      // Cap DPR — on retina/4K displays Mapbox renders at 2x by default which
      // quadruples tile fetches and pixel work. Visually indistinguishable on
      // satellite imagery, much faster.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any).setMaxPixelRatio?.(1.5);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Mapbox failed to initialize";
      console.error("[FenceMap] init failed:", err);
      setErrorMsg(msg);
      return;
    }
    mapRef.current = map;

    map.on("error", (e) => {
      const m = e?.error?.message ?? "Map error";
      console.error("[FenceMap] map error:", e);
      setErrorMsg(m);
    });
    map.on("load", () => {
      console.info("[FenceMap] style loaded");
      setTimeout(() => map.resize(), 50);
    });
    map.on("style.load", () => {
      console.info("[FenceMap] style.load fired");
    });

    // ResizeObserver — keep the map sized to its container even if the parent
    // flex layout settles after init. Cheap; drives map.resize() on any change.
    const ro = new ResizeObserver(() => {
      const r = containerRef.current?.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) {
        map.resize();
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

    let draw: MapboxDraw;
    try {
      draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { line_string: true, polygon: true, trash: true },
        defaultMode: "draw_line_string",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        styles: fenceDrawStyles as any,
      });
    } catch (err) {
      console.error("[FenceMap] draw init failed:", err);
      setErrorMsg("Drawing tool failed to load");
      return;
    }
    drawRef.current = draw;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.addControl(draw as any, "top-right");

    function emitStats() {
      const fc = draw.getAll();
      const feature = (fc.features[fc.features.length - 1] as Feature<
        LineString | Polygon
      >) ?? null;
      const stats: FenceGeometryStats = {
        feature,
        linear_feet: feature ? geometryLF(feature) : 0,
        corner_count: feature ? cornerCount(feature) : 0,
        closed: feature?.geometry.type === "Polygon",
      };
      onChangeRef.current(stats);
    }

    map.on("draw.create", emitStats);
    map.on("draw.update", emitStats);
    map.on("draw.delete", emitStats);
    map.on("draw.modechange", emitStats);
    // Live update during drawing — covers mid-line tap before "create" fires
    map.on("draw.render", emitStats);

    return () => {
      try {
        ro.disconnect();
        map.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
      drawRef.current = null;
    };
    // Center change after mount is intentional — recreating the map on every
    // pan would lose the in-progress geometry. Quote address is fixed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync gate markers to the gates prop ─────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    // Wipe existing markers; cheap for the small N (max ~5–10 gates per quote)
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    if (!gates) return;
    for (const g of gates) {
      const el = makeGateMarkerEl(g.type);
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([g.position.lng, g.position.lat])
        .addTo(mapRef.current);
      markersRef.current.push(marker);
    }
  }, [gates]);

  // ── Gate placement mode: switch draw to simple_select, intercept clicks ──
  useEffect(() => {
    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw) return;

    if (!gatePlacementMode) {
      // Returning to drawing — restore line mode unless polygon is in progress
      const fc = draw.getAll();
      const last = fc.features[fc.features.length - 1];
      if (!last || last.geometry.type === "LineString") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (draw as any).changeMode("draw_line_string");
      }
      return;
    }

    // Entering placement mode — stop drawing so taps don't add vertices
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (draw as any).changeMode("simple_select");

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      const fc = draw.getAll();
      const feature = fc.features[fc.features.length - 1] as
        | Feature<LineString | Polygon>
        | undefined;
      if (!feature) return;
      const coords =
        feature.geometry.type === "Polygon"
          ? feature.geometry.coordinates[0]
          : feature.geometry.coordinates;
      if (coords.length < 2) return;

      const line = turfLineString(coords as [number, number][]);
      const clicked = turfPoint([e.lngLat.lng, e.lngLat.lat]);
      const snapped = nearestPointOnLine(line, clicked, { units: "kilometers" });
      const dist = snapped.properties.dist as number;
      if (dist > GATE_SNAP_MAX_KM) {
        console.info(
          `[FenceMap] gate tap rejected — ${dist.toFixed(4)}km from line (max ${GATE_SNAP_MAX_KM})`
        );
        return;
      }
      const [lng, lat] = snapped.geometry.coordinates as [number, number];
      onGatePointPickedRef.current?.({ lat, lng });
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [gatePlacementMode]);

  useImperativeHandle(handleRef, () => ({
    reset() {
      drawRef.current?.deleteAll();
      drawRef.current?.changeMode("draw_line_string");
    },
    undo() {
      // mapbox-gl-draw doesn't expose undo, so we approximate: in drawing mode
      // the trash button removes the last point. Surface the same action here
      // if user is mid-line.
      const all = drawRef.current?.getAll();
      if (!all || all.features.length === 0) return;
      drawRef.current?.trash();
    },
    setMode(mode) {
      const target = mode === "polygon" ? "draw_polygon" : "draw_line_string";
      // @types/mapbox__mapbox-gl-draw@1.4 has narrower overloads than runtime
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (drawRef.current as any)?.changeMode(target);
    },
  }));

  return (
    <div
      className="relative w-full"
      style={{ height: "100%", minHeight: 500 }}
    >
      <div
        ref={containerRef}
        className="absolute inset-0 bg-navy/5"
        style={{ minHeight: 500 }}
        role="application"
        aria-label="Fence drawing map"
      />
      {errorMsg && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/95 p-6">
          <div className="max-w-sm text-center">
            <div className="text-sm font-semibold text-navy">
              Couldn&rsquo;t load the map
            </div>
            <div className="mt-1 text-xs text-navy/60">{errorMsg}</div>
            <div className="mt-3 text-[11px] text-navy/40">
              Open DevTools console for details. Common fixes: bad
              NEXT_PUBLIC_MAPBOX_TOKEN, URL restrictions excluding
              localhost, or missing scopes on the token.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

