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

export type ParcelBoundary = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

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
  // Phase 1.5 — gate edit affordances
  onGateMove?: (index: number, position: { lat: number; lng: number }) => void;
  onGateDelete?: (index: number) => void;
  // Phase 1.5 — parcel boundary overlay from Regrid
  parcelBoundary?: ParcelBoundary | null;
  // Phase 2 — neighbor parcel outlines (rendered fainter under the primary)
  adjacentBoundaries?: ParcelBoundary[];
}

const GATE_WIDTH_LABEL: Record<GateType, string> = {
  W4: "4'",
  W5: "5'",
  D10: "10'",
  D12: "12'",
  D16: "16'",
};

function makeGateMarkerEl(
  type: GateType,
  index: number,
  onDelete?: (i: number) => void
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = GATE_MARKER_CLASS;
  el.setAttribute("aria-label", `Gate: ${GATE_WIDTH_LABEL[type]} ${type}`);

  const label = document.createElement("span");
  label.textContent = GATE_WIDTH_LABEL[type];
  el.appendChild(label);

  if (onDelete) {
    const x = document.createElement("button");
    x.className = "qos-gate-marker-delete";
    x.type = "button";
    x.setAttribute("aria-label", `Delete gate ${index + 1}`);
    x.textContent = "×";
    // Stop pointerdown so a tap on × doesn't initiate a marker drag
    x.addEventListener("pointerdown", (e) => e.stopPropagation());
    x.addEventListener("mousedown", (e) => e.stopPropagation());
    x.addEventListener("touchstart", (e) => e.stopPropagation());
    x.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      onDelete(index);
    });
    el.appendChild(x);
  }

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
  onGateMove,
  onGateDelete,
  parcelBoundary,
  adjacentBoundaries,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const initLogRef = useRef<string[]>([]);
  const logInit = (line: string) => {
    initLogRef.current.push(line);
    console.info("[FenceMap]", line);
  };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onGatePointPickedRef = useRef(onGatePointPicked);
  onGatePointPickedRef.current = onGatePointPicked;
  const onGateMoveRef = useRef(onGateMove);
  onGateMoveRef.current = onGateMove;
  const onGateDeleteRef = useRef(onGateDelete);
  onGateDeleteRef.current = onGateDelete;
  // Mirror the gatePlacementMode prop into a ref so the modechange listener
  // (defined inside the mount-once effect) can read the current value. The
  // listener uses this to skip its CRIT-1 auto-revert when the customer is
  // intentionally in simple_select for gate placement.
  const gatePlacementModeRef = useRef(!!gatePlacementMode);
  gatePlacementModeRef.current = !!gatePlacementMode;
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    logInit(`mount centerLat=${centerLat} centerLng=${centerLng}`);

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      const msg = "NEXT_PUBLIC_MAPBOX_TOKEN is not set in .env.local";
      logInit(`FAIL: ${msg}`);
      console.error("[FenceMap]", msg);
      setErrorMsg(msg);
      return;
    }
    logInit(`token present (len=${token.length})`);
    mapboxgl.accessToken = token;

    // Diagnostic: log container dimensions before init. If width or height is
    // 0 at this point, Mapbox renders to a zero-pixel canvas and silently
    // skips tile fetches — which is exactly the symptom of a "loaded but
    // blank" map.
    const rect = containerRef.current.getBoundingClientRect();
    logInit(
      `container size at init: ${rect.width.toFixed(0)} × ${rect.height.toFixed(0)}`
    );
    if (rect.width < 10 || rect.height < 10) {
      console.warn(
        "[FenceMap] container is near-zero — map will be blank. Parent layout may not have settled."
      );
    }
    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
      const msg = `Invalid coordinates from quote (lat=${centerLat}, lng=${centerLng}). Re-enter the address to fix.`;
      logInit(`FAIL: ${msg}`);
      console.error("[FenceMap]", msg);
      setErrorMsg(msg);
      return;
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

    // Mapbox emits "error" for both fatal init failures AND transient tile
    // fetch failures. Setting the terminal error overlay on every tile blip
    // would kill the map for a single tile that didn't load. Only treat the
    // error as fatal if the style itself failed to load — tile fetches that
    // fail mid-session retry on their own.
    map.on("error", (e) => {
      const m = e?.error?.message ?? "Map error";
      const isTileFetch = /tile|HTTP/i.test(m);
      console.error("[FenceMap] map error:", e);
      if (!isTileFetch) {
        setErrorMsg(m);
      }
    });
    map.on("load", () => {
      console.info("[FenceMap] style loaded");
      setTimeout(() => map.resize(), 50);
    });
    map.on("style.load", () => {
      console.info("[FenceMap] style.load fired");
      // Overlay house numbers from the Mapbox Streets vector tileset so users
      // can identify which roof is theirs. Adding just this one symbol layer is
      // far cheaper than switching the base style to satellite-streets-v12
      // (see SATELLITE_STYLE comment in draw-config.ts).
      try {
        if (!map.getSource("qos-streets")) {
          map.addSource("qos-streets", {
            type: "vector",
            url: "mapbox://mapbox.mapbox-streets-v8",
          });
        }
        if (!map.getLayer("qos-housenum")) {
          // Insert before any gl-draw layers so fence lines stay on top of labels.
          const beforeId = map
            .getStyle()
            .layers?.find((l) => l.id.startsWith("gl-draw"))?.id;
          map.addLayer(
            {
              id: "qos-housenum",
              type: "symbol",
              source: "qos-streets",
              "source-layer": "housenum_label",
              minzoom: 17,
              layout: {
                "text-field": ["get", "house_num"],
                "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
                "text-size": 12,
                "text-padding": 2,
              },
              paint: {
                "text-color": "#FFFFFF",
                "text-halo-color": "rgba(0,0,0,0.75)",
                "text-halo-width": 1.5,
              },
            },
            beforeId
          );
        }
      } catch (err) {
        console.warn("[FenceMap] house-number overlay failed:", err);
      }
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

    // Zoom in bottom-right (per /draw mobile layout spec — keeps the map
    // clean and away from where labels + draw controls would crowd).
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "bottom-right"
    );
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

    // Custom "place_gate" mode — features are rendered but no clicks, no
    // selection, no vertex-drag. Used during gate placement so our own
    // click handler is the only thing reacting to taps. Without this,
    // gl-draw's simple_select kept flipping into direct_select on every
    // line tap, which (a) blocked gate placement and (b) interpreted
    // pinch-zoom gestures as vertex drags on the fence.
    //
    // CRITICAL: toDisplayFeatures must stamp each feature's
    // `properties.active = "false"` before calling display(). Without
    // that property, gl-draw's style rules find no match and the
    // feature renders invisibly — symptom: "fence line disappears
    // when I switch to gate mode."
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const PlaceGateMode = {
      onSetup() {
        return {};
      },
      toDisplayFeatures(
        _state: unknown,
        geojson: any,
        display: (g: unknown) => void
      ) {
        if (geojson.properties) {
          geojson.properties.active = "false";
        }
        display(geojson);
      },
      onClick() {},
      onTap() {},
      onMouseDown() {},
      onTouchStart() {},
      onKeyUp() {},
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */

    let draw: MapboxDraw;
    try {
      draw = new MapboxDraw({
        // displayControlsDefault: false + empty controls = no MapboxDraw
        // right-rail stack. All draw controls live in our own zone above
        // and below the map; the in-map surface stays clean.
        displayControlsDefault: false,
        controls: {},
        defaultMode: "draw_line_string",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        styles: fenceDrawStyles as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        modes: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...((MapboxDraw as any).modes),
          place_gate: PlaceGateMode,
        },
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
      // Prefer the feature with the most coordinates over "the most recent
      // feature". Edge cases (mode-thrash, accidental new feature start)
      // can leave a 1-vertex stub as the latest entry, which would zero out
      // linear_feet and grey the Undo/Clear buttons even though there's
      // a real drawn fence elsewhere in the collection.
      let primary: Feature<LineString | Polygon> | null = null;
      let primaryCoordCount = -1;
      for (const f of fc.features) {
        const g = f.geometry;
        let coordCount = 0;
        if (g.type === "LineString") coordCount = g.coordinates.length;
        else if (g.type === "Polygon") coordCount = g.coordinates[0].length;
        else continue;
        if (coordCount > primaryCoordCount) {
          primaryCoordCount = coordCount;
          primary = f as Feature<LineString | Polygon>;
        }
      }
      const stats: FenceGeometryStats = {
        feature: primary,
        linear_feet: primary ? geometryLF(primary) : 0,
        corner_count: primary ? cornerCount(primary) : 0,
        closed: primary?.geometry.type === "Polygon",
      };
      onChangeRef.current(stats);
    }

    map.on("draw.create", emitStats);
    map.on("draw.update", emitStats);
    map.on("draw.delete", emitStats);
    map.on("draw.modechange", emitStats);
    // Live update during drawing — covers mid-line tap before "create" fires
    map.on("draw.render", emitStats);

    // CRIT-1 auto-recovery: mapbox-gl-draw silently exits draw_line_string
    // into simple_select on certain user gestures (double-tap, tap near
    // an existing vertex). The user sees "tapping stopped working"
    // because they're now in select mode with no visual cue. We listen
    // for that flip and bounce back to draw mode — but ONLY when:
    //   1) the customer is NOT in gate-placement mode (that mode
    //      intentionally uses simple_select; bouncing out breaks gate
    //      placement and was the cause of the gate-cascade bug)
    //   2) the current feature has a stable id we can resume into
    //      (avoid creating phantom features)
    //   3) the feature has fewer than 4 vertices (line) or a still-open
    //      ring (polygon) — i.e., it's mid-draw, not finished.
    map.on("draw.modechange", (e: { mode: string }) => {
      try {
        // GLOBAL: never allow direct_select. It's vertex-editing mode —
        // we don't support customer-side vertex editing, AND it causes
        // pinch-zoom gestures to be interpreted as vertex drags (a
        // finger lands on a vertex, gl-draw thinks "drag this corner").
        // Bounce out immediately:
        //   - if in gate mode → static (no interaction)
        //   - otherwise → simple_select (still selectable, just not editable)
        if (e.mode === "direct_select") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (draw as any).changeMode(
            gatePlacementModeRef.current ? "place_gate" : "simple_select"
          );
          return;
        }
        if (e.mode !== "simple_select") return;
        if (gatePlacementModeRef.current) return; // ← protects gate flow
        const fc = draw.getAll();
        const feature = fc.features[fc.features.length - 1];
        if (!feature) {
          // Nothing drawn — restore drawing mode so the next tap places
          // the first vertex.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (draw as any).changeMode("draw_line_string");
          return;
        }
        if (feature.id == null) return; // no stable id; don't risk it
        const geom = feature.geometry;
        if (geom.type === "LineString" && geom.coordinates.length < 4) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (draw as any).changeMode("draw_line_string", {
            featureId: feature.id,
            from: geom.coordinates[geom.coordinates.length - 1],
          });
        } else if (geom.type === "Polygon" && geom.coordinates[0].length < 4) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (draw as any).changeMode("draw_polygon", { featureId: feature.id });
        }
      } catch (err) {
        // Never let a recovery attempt itself break the map.
        console.warn("[FenceMap] modechange recovery failed", err);
      }
    });

    // Right-click to finish the current line/polygon. Without this the
    // phantom cursor-vertex keeps tracking the mouse and there's no way to
    // stop drawing other than double-click (easy to miss on touchpads).
    map.on("contextmenu", (e) => {
      e.preventDefault();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const drawAny = draw as any;
      const m = drawAny.getMode?.() as string | undefined;
      if (m === "draw_line_string" || m === "draw_polygon") {
        drawAny.changeMode("simple_select");
      }
    });

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

  // ── Sync parcel-boundary overlay ─────────────────────────────────
  // Renders a dashed cyan outline of the property parcel so the user can see
  // where the lot line is before drawing. Layer sits below the gl-draw layers
  // so the orange fence line stays visually on top.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const PARCEL_SOURCE = "qos-parcel";
    const PARCEL_LAYER = "qos-parcel-outline";

    function applyOverlay() {
      if (!map) return;
      if (!parcelBoundary) {
        if (map.getLayer(PARCEL_LAYER)) map.removeLayer(PARCEL_LAYER);
        if (map.getSource(PARCEL_SOURCE)) map.removeSource(PARCEL_SOURCE);
        return;
      }
      const data: GeoJSON.Feature = {
        type: "Feature",
        properties: {},
        geometry: parcelBoundary as GeoJSON.Polygon | GeoJSON.MultiPolygon,
      };
      const existing = map.getSource(PARCEL_SOURCE) as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (existing) {
        existing.setData(data);
        return;
      }
      map.addSource(PARCEL_SOURCE, { type: "geojson", data });
      // Insert before the first gl-draw layer so the fence line renders above
      const beforeId = map
        .getStyle()
        .layers?.find((l) => l.id.startsWith("gl-draw"))?.id;
      map.addLayer(
        {
          id: PARCEL_LAYER,
          type: "line",
          source: PARCEL_SOURCE,
          paint: {
            "line-color": "#22D3EE", // cyan — distinct from accent orange + satellite
            "line-width": 2,
            "line-dasharray": [3, 2],
            "line-opacity": 0.85,
          },
        },
        beforeId
      );
    }

    if (map.isStyleLoaded()) {
      applyOverlay();
    } else {
      map.once("style.load", applyOverlay);
    }
  }, [parcelBoundary]);

  // ── Sync adjacent-parcel outlines ────────────────────────────────
  // Renders all neighbor parcels as a fainter dashed line so the customer
  // can see the full block context — helpful for "which side borders the
  // neighbor" reasoning. Layered below the primary parcel outline.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const SOURCE = "qos-adjacent-parcels";
    const LAYER = "qos-adjacent-parcels-line";

    function applyOverlay() {
      if (!map) return;
      if (!adjacentBoundaries || adjacentBoundaries.length === 0) {
        if (map.getLayer(LAYER)) map.removeLayer(LAYER);
        if (map.getSource(SOURCE)) map.removeSource(SOURCE);
        return;
      }
      const data: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: adjacentBoundaries.map((b) => ({
          type: "Feature",
          properties: {},
          geometry: b as GeoJSON.Polygon | GeoJSON.MultiPolygon,
        })),
      };
      const existing = map.getSource(SOURCE) as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (existing) {
        existing.setData(data);
        return;
      }
      // Insert under qos-parcel-outline if present, otherwise under gl-draw
      const layers = map.getStyle().layers ?? [];
      const beforeId =
        layers.find((l) => l.id === "qos-parcel-outline")?.id ??
        layers.find((l) => l.id.startsWith("gl-draw"))?.id;
      map.addLayer(
        {
          id: LAYER,
          type: "line",
          source: SOURCE,
          paint: {
            "line-color": "#22D3EE",
            "line-width": 1,
            "line-dasharray": [2, 3],
            "line-opacity": 0.4,
          },
        },
        beforeId
      );
    }

    if (map.isStyleLoaded()) {
      applyOverlay();
    } else {
      map.once("style.load", applyOverlay);
    }
  }, [adjacentBoundaries]);

  // ── Sync gate markers to the gates prop ─────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Wipe existing markers; cheap for the small N (max ~5–10 gates per quote)
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    if (!gates) return;

    gates.forEach((g, idx) => {
      const el = makeGateMarkerEl(g.type, idx, onGateDeleteRef.current);
      const draggable = !!onGateMoveRef.current;
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "center",
        draggable,
      })
        .setLngLat([g.position.lng, g.position.lat])
        .addTo(map);

      if (draggable) {
        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          const draw = drawRef.current;
          const fc = draw?.getAll();
          const feature = fc?.features[fc.features.length - 1] as
            | Feature<LineString | Polygon>
            | undefined;
          if (!feature) {
            onGateMoveRef.current?.(idx, { lat: lngLat.lat, lng: lngLat.lng });
            return;
          }
          const coords =
            feature.geometry.type === "Polygon"
              ? feature.geometry.coordinates[0]
              : feature.geometry.coordinates;
          if (coords.length < 2) {
            onGateMoveRef.current?.(idx, { lat: lngLat.lat, lng: lngLat.lng });
            return;
          }
          // Snap the drop point to the line so the gate stays on the fence
          const line = turfLineString(coords as [number, number][]);
          const dropped = turfPoint([lngLat.lng, lngLat.lat]);
          const snapped = nearestPointOnLine(line, dropped, {
            units: "kilometers",
          });
          const [lng, lat] = snapped.geometry.coordinates as [number, number];
          onGateMoveRef.current?.(idx, { lat, lng });
        });
      }

      markersRef.current.push(marker);
    });
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

    // Entering placement mode — switch to our custom place_gate mode so
    // gl-draw stops reacting to taps entirely. Our own map.on('click')
    // is the only handler that runs; no risk of accidental selection
    // or vertex-drag. (Mode name deliberately NOT "static" — the existing
    // fenceDrawStyles filter the static mode out as invisible.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (draw as any).changeMode("place_gate");

    // Visual cue: the map cursor turns to crosshair while in placement mode
    // so the user understands "tap somewhere" rather than the default arrow.
    const canvas = map.getCanvas();
    const prevCursor = canvas.style.cursor;
    canvas.style.cursor = "crosshair";

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      const fc = draw.getAll();
      // Pick the feature with the most coordinates — same heuristic as
      // emitStats above, so a 1-vertex stub doesn't shadow the real fence.
      let feature: Feature<LineString | Polygon> | undefined;
      let bestCount = -1;
      for (const f of fc.features) {
        const g = f.geometry;
        const c =
          g.type === "Polygon"
            ? g.coordinates[0].length
            : g.type === "LineString"
              ? g.coordinates.length
              : 0;
        if (c > bestCount) {
          bestCount = c;
          feature = f as Feature<LineString | Polygon>;
        }
      }
      if (!feature) {
        console.info("[FenceMap] gate click: no feature yet");
        return;
      }
      const coords =
        feature.geometry.type === "Polygon"
          ? feature.geometry.coordinates[0]
          : feature.geometry.coordinates;
      if (coords.length < 2) {
        console.info(
          `[FenceMap] gate click: feature has only ${coords.length} coord(s)`
        );
        return;
      }

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
      console.info(
        `[FenceMap] gate snap ok — dist=${dist.toFixed(4)}km, point=[${lng.toFixed(6)},${lat.toFixed(6)}]`
      );
      onGatePointPickedRef.current?.({ lat, lng });
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
      canvas.style.cursor = prevCursor;
    };
  }, [gatePlacementMode]);

  useImperativeHandle(handleRef, () => ({
    reset() {
      drawRef.current?.deleteAll();
      drawRef.current?.changeMode("draw_line_string");
    },
    undo() {
      const draw = drawRef.current;
      if (!draw) return;
      const all = draw.getAll();
      if (all.features.length === 0) return;
      const feature = all.features[all.features.length - 1];
      const geom = feature.geometry;
      const id = feature.id as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mode = (draw as any).getMode?.() as string | undefined;
      const drawingLine = mode === "draw_line_string";
      const drawingPoly = mode === "draw_polygon";

      // NOTE: mapbox-gl-draw's `trash()` in draw_line_string mode deletes the
      // ENTIRE feature, not just the last vertex (despite some doc pages
      // suggesting otherwise). We pop the last clicked coord manually.

      if (geom.type === "LineString") {
        const coords = geom.coordinates;
        // In draw_line_string mode the trailing coordinate is the phantom
        // cursor-follower, so the most recently *clicked* vertex is at -2.
        // After drawing finishes (simple_select), every coord is real.
        const popTarget = drawingLine ? coords.length - 2 : coords.length - 1;
        const newCoords = coords.slice(0, popTarget);

        if (newCoords.length < 2) {
          draw.delete(id);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (draw as any).changeMode("draw_line_string");
          return;
        }
        draw.add({
          type: "Feature",
          id,
          properties: feature.properties ?? {},
          geometry: { type: "LineString", coordinates: newCoords },
        });
        // Resume drawing from the new last vertex so the user can keep going
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (draw as any).changeMode("draw_line_string", { featureId: id });
        return;
      }

      if (geom.type === "Polygon") {
        const ring = geom.coordinates[0];
        // Polygons repeat the first coord at the end of the ring; in
        // draw_polygon mode there's also a phantom cursor coord just before
        // the closing duplicate.
        const popTarget = drawingPoly ? ring.length - 3 : ring.length - 2;
        if (popTarget < 2) {
          draw.delete(id);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (draw as any).changeMode("draw_line_string");
          return;
        }
        const newRing = ring.slice(0, popTarget + 1).concat([ring[0]]);
        draw.add({
          type: "Feature",
          id,
          properties: feature.properties ?? {},
          geometry: { type: "Polygon", coordinates: [newRing] },
        });
        if (drawingPoly) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (draw as any).changeMode("draw_polygon", { featureId: id });
        }
      }
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
        <div className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-paper/95 p-6">
          <div className="max-w-sm text-center">
            <div className="font-display text-[18px] font-bold uppercase tracking-eyebrow text-navy">
              Map Didn&rsquo;t Load
            </div>
            <p className="mt-2 font-body text-[13px] leading-[1.5] text-char">
              Network hiccup or token issue. Try again first; if it
              persists, re-enter your address to start fresh.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") window.location.reload();
                }}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-sm bg-brick px-6 font-display text-[13px] font-semibold uppercase tracking-eyebrow text-cream shadow-cta transition-colors hover:bg-brick-deep"
              >
                Try Again
              </button>
              <a
                href="/address"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-navy/30 px-4 font-display text-[12px] font-semibold uppercase tracking-eyebrow text-navy transition-colors hover:border-navy hover:bg-navy/5"
              >
                Re-enter Address
              </a>
            </div>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-spec text-steel">
              {errorMsg}
            </p>
            <details className="mt-2 text-left">
              <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-spec text-steel">
                Diagnostics
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-sm bg-navy/5 p-2 font-mono text-[10px] leading-snug text-char">
                {initLogRef.current.join("\n")}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

