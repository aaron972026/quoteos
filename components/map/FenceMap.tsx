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
  // Real user-placed vertex count, excluding gl-draw's trailing phantom
  // cursor-follower (in draw_line_string/draw_polygon modes) and the
  // polygon ring's closing duplicate. Stable across mode changes, so it
  // can drive an undo stack without spurious increments when the user
  // toggles gate mode on/off.
  vertex_count: number;
}

export interface FenceMapHandle {
  reset(): void;
  undo(): void;
  setMode(mode: "line" | "polygon"): void;
  /**
   * Replace whatever is drawn with the given feature (e.g. a traced lot
   * line). LineStrings resume draw_line_string from their last vertex so
   * the customer can keep tapping; Polygons land in simple_select.
   */
  loadFeature(feature: Feature<LineString | Polygon>): void;
  /**
   * Like loadFeature, but lands in the inert place_gate mode: the
   * feature renders, taps do nothing, and gl-draw holds no drawing
   * state — which makes live geometry rewrites via setFeatureCoords
   * safe. Used while endpoint trim handles are active.
   */
  loadFeatureStatic(feature: Feature<LineString | Polygon>): void;
  /**
   * Rewrite the active LineString's coordinates in place. ONLY safe
   * while in a non-drawing mode (loadFeatureStatic) — rewriting under
   * draw_line_string desyncs gl-draw's currentVertexPosition.
   */
  setFeatureCoords(coords: number[][]): void;
  /** Resume draw_line_string from the active line's last vertex. */
  resumeLine(): void;
  /**
   * The drawn geometry with gl-draw's phantom cursor-follower stripped.
   * In draw_line_string / draw_polygon mode the feature's trailing
   * coordinate is the rubber-band point under the cursor — on desktop
   * that sits wherever the mouse last touched the map, so saving the
   * raw feature inflates linear feet by the rubber-band segment. Use
   * this (not the live stats feature) for the PATCH payload.
   */
  getFinalFeature(): {
    feature: Feature<LineString | Polygon>;
    linear_feet: number;
    corner_count: number;
  } | null;
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
  // Endpoint trim handles — big draggable dots on the traced line's two
  // ends. The page owns the trim math; FenceMap just renders markers and
  // reports raw drag positions.
  trimHandles?: Array<{ lat: number; lng: number }> | null;
  onTrimHandleDrag?: (
    index: number,
    position: { lat: number; lng: number },
    phase: "move" | "end"
  ) => void;
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
  trimHandles,
  onTrimHandleDrag,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  // Zoom loupe — second non-interactive Mapbox instance in a circular
  // overlay that follows the pointer/touch. Hidden by default; shows
  // during cursor-over (desktop) or a touch-drag (mobile). Positioned
  // above the finger so the user can see what's beneath without it
  // being covered.
  const loupeContainerRef = useRef<HTMLDivElement>(null);
  const loupeWrapperRef = useRef<HTMLDivElement>(null);
  const loupeMapRef = useRef<mapboxgl.Map | null>(null);
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
  const trimMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const onTrimHandleDragRef = useRef(onTrimHandleDrag);
  onTrimHandleDragRef.current = onTrimHandleDrag;
  // Id of the feature loaded via loadFeature/loadFeatureStatic so
  // setFeatureCoords can rewrite the right one without guessing.
  const loadedFeatureIdRef = useRef<string | null>(null);
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
      // NOTE: a previous `setMaxPixelRatio(1.5)` call here was a silent
      // no-op — that method does not exist anywhere in mapbox-gl 3.23.x
      // (verified against the dist bundle), so the map has always
      // rendered at native devicePixelRatio. Removed rather than kept as
      // a misleading "perf cap."
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Mapbox failed to initialize";
      console.error("[FenceMap] init failed:", err);
      setErrorMsg(msg);
      return;
    }
    mapRef.current = map;

    // Mapbox emits "error" for both fatal init failures AND transient
    // mid-session failures. The terminal overlay is only justified when
    // the map never got to a usable state: once the style has loaded
    // successfully, any later error (tile blip, vector-source hiccup,
    // brief network drop) self-recovers on retry — slapping the fatal
    // "Map Didn't Load" overlay over a WORKING map with the user's
    // drawn fence underneath is strictly worse than logging it.
    let loadedOnce = false;
    map.on("error", (e) => {
      const m = e?.error?.message ?? "Map error";
      const isTileFetch = /tile|HTTP/i.test(m);
      console.error("[FenceMap] map error:", e);
      if (!isTileFetch && !loadedOnce) {
        setErrorMsg(m);
      }
    });
    map.on("load", () => {
      loadedOnce = true;
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
    // line tap.
    //
    // CRITICAL: toDisplayFeatures must stamp each feature's
    // `properties.active = "false"` before calling display(). Without
    // that, gl-draw's style filter `["!=", "active", "true"]` does
    // match, but the line still won't render in some setups because
    // the feature lacks the activeness hint. Stamp it explicitly.
    //
    // Modes are registered by mutating MapboxDraw.modes BEFORE the
    // draw instance is constructed — more reliable across versions than
    // passing `modes` as a constructor option (which has changed
    // shape between mapbox-gl-draw releases). Side effect on the
    // global modes table is one-time and idempotent.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const PlaceGateMode = {
      onSetup() {
        logInit("PlaceGateMode.onSetup called");
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
      onMouseUp() {},
      onMouseMove() {},
      onTouchStart() {},
      onTouchMove() {},
      onTouchEnd() {},
      onKeyUp() {},
      onTrash() {},
      onDoubleClick() {},
      onStop() {},
    };
    // Extend the global modes table so the draw instance picks it up
    // alongside all default modes. Guard against double-registration.
    const MD = MapboxDraw as any;
    if (!MD.modes) {
      console.warn("[FenceMap] MapboxDraw.modes is undefined — custom modes may not work");
    } else if (!MD.modes.place_gate) {
      MD.modes.place_gate = PlaceGateMode;
      logInit("registered place_gate mode on MapboxDraw.modes");
    }
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
      });
    } catch (err) {
      console.error("[FenceMap] draw init failed:", err);
      setErrorMsg("Drawing tool failed to load");
      return;
    }
    drawRef.current = draw;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.addControl(draw as any, "top-right");

    // emitStats runs on every draw.render, which fires far more often
    // than the geometry actually changes (zoom changes, style rerenders).
    // Each call used to push a brand-new stats object into the parent's
    // React state — a full /draw page re-render plus a slope-detect
    // debounce reset per frame. Skip the onChange when nothing material
    // moved. The signature includes the last coordinate so phantom
    // (rubber-band) movement still streams live LF updates.
    let lastStatsSig = "";
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mode = (draw as any).getMode?.() as string | undefined;
      const isDrawingLine = mode === "draw_line_string";
      const isDrawingPoly = mode === "draw_polygon";
      let vertex_count = 0;
      if (primary) {
        if (primary.geometry.type === "LineString") {
          vertex_count = Math.max(
            0,
            primary.geometry.coordinates.length - (isDrawingLine ? 1 : 0)
          );
        } else {
          // Polygon: subtract the closing duplicate AND the phantom (in draw mode)
          vertex_count = Math.max(
            0,
            primary.geometry.coordinates[0].length - 1 - (isDrawingPoly ? 1 : 0)
          );
        }
      }
      const stats: FenceGeometryStats = {
        feature: primary,
        linear_feet: primary ? geometryLF(primary) : 0,
        corner_count: primary ? cornerCount(primary) : 0,
        closed: primary?.geometry.type === "Polygon",
        vertex_count,
      };
      let lastCoord: number[] | undefined;
      if (primary) {
        const c =
          primary.geometry.type === "Polygon"
            ? primary.geometry.coordinates[0]
            : primary.geometry.coordinates;
        lastCoord = c[c.length - 1];
      }
      const sig = [
        stats.linear_feet.toFixed(2),
        stats.corner_count,
        stats.closed,
        stats.vertex_count,
        lastCoord ? `${lastCoord[0].toFixed(7)},${lastCoord[1].toFixed(7)}` : "",
      ].join("|");
      if (sig === lastStatsSig) return;
      lastStatsSig = sig;
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

    // ── Zoom loupe ───────────────────────────────────────────────
    // A second, non-interactive Mapbox instance in a circular overlay.
    // Hidden by default. Behavior:
    //   • Desktop — appears wherever the cursor enters the map, follows
    //     it, hides on leave.
    //   • Mobile  — appears after a short drag-distance threshold while
    //     a finger is down (so a quick tap-to-place doesn't flash it),
    //     follows the finger, hides on touchend.
    // The loupe DIV is positioned ABOVE the touch point so the finger
    // doesn't cover what it's trying to show. The loupe MAP's geographic
    // center is re-derived from the pointer's SCREEN position on every
    // map render — so when the user pans (finger stays still relative
    // to the map, but geography shifts), the loupe content still updates.
    const LOUPE_ZOOM_DELTA = 2;
    const LOUPE_SIZE = 160;
    const LOUPE_FINGER_OFFSET_Y = 110; // distance from finger to loupe center
    const LOUPE_LONG_PRESS_MS = 250;
    const LOUPE_PAN_ABORT_PX = 12; // movement within long-press window = pan, not loupe
    let loupeMap: mapboxgl.Map | null = null;
    let loupeRo: ResizeObserver | null = null;

    // Pointer state — `pointerX/Y` are screen coords relative to the
    // map container (i.e., `e.point` from Mapbox events). `pointerActive`
    // means "loupe is visible" (set true on mouse-over OR after a touch
    // long-press confirms loupe mode).
    let pointerX = 0;
    let pointerY = 0;
    let pointerActive = false;
    // Touch state machine — quick taps go through to gl-draw / gate
    // handler unchanged; only a long-press WITHOUT significant movement
    // promotes to loupe mode. In loupe mode, map pan is disabled so the
    // finger drags the loupe (not the map), and release drops a vertex
    // at the loupe target.
    let touchPhase: "idle" | "pending" | "loupe" = "idle";
    let touchStartX = 0;
    let touchStartY = 0;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;

    // The loupe is mobile-only (it summons exclusively from a touch
    // long-press), but the second Map instance was being constructed on
    // EVERY device — each `new mapboxgl.Map` is a billed map load and a
    // second WebGL context. Desktop mouse users can never summon it, so
    // skip construction entirely unless the device can produce touches.
    const touchCapable =
      typeof window !== "undefined" &&
      (navigator.maxTouchPoints > 0 ||
        window.matchMedia?.("(pointer: coarse)")?.matches === true);

    if (touchCapable && loupeContainerRef.current) {
      try {
        loupeMap = new mapboxgl.Map({
          container: loupeContainerRef.current,
          style: SATELLITE_STYLE,
          center: [centerLng, centerLat],
          zoom: Math.min(MAP_DEFAULTS.maxZoom, MAP_DEFAULTS.zoom + LOUPE_ZOOM_DELTA),
          minZoom: MAP_DEFAULTS.minZoom,
          maxZoom: MAP_DEFAULTS.maxZoom,
          interactive: false,
          attributionControl: false,
          antialias: true,
          fadeDuration: 0,
          preserveDrawingBuffer: false,
        });
        // Use native devicePixelRatio for sharp imagery. Capping previously
        // at 1.5 made retina screens look soft; the loupe is only on
        // briefly during interaction so the GPU cost is acceptable.
        loupeMapRef.current = loupeMap;
        loupeMap.on("load", () => {
          console.info("[FenceMap] loupe style loaded");
          setTimeout(() => loupeMap?.resize(), 50);
        });
        loupeRo = new ResizeObserver(() => {
          const r = loupeContainerRef.current?.getBoundingClientRect();
          if (r && r.width > 0 && r.height > 0) {
            loupeMap?.resize();
          }
        });
        loupeRo.observe(loupeContainerRef.current);
      } catch (err) {
        console.warn("[FenceMap] loupe init failed:", err);
        loupeMap = null;
      }
    } else if (touchCapable) {
      console.warn("[FenceMap] loupe container ref is null at init");
    }

    function setLoupeVisible(visible: boolean) {
      const wrap = loupeWrapperRef.current;
      if (!wrap) return;
      wrap.style.opacity = visible ? "1" : "0";
      wrap.style.pointerEvents = "none";
    }
    function positionLoupeWrapper(x: number, y: number) {
      const wrap = loupeWrapperRef.current;
      if (!wrap) return;
      // Center loupe at (x, y - offset). Translate top-left so the
      // resulting wrapper center lands at that point.
      const tx = x - LOUPE_SIZE / 2;
      const ty = y - LOUPE_FINGER_OFFSET_Y - LOUPE_SIZE / 2;
      wrap.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    }
    function updateLoupeContent() {
      if (!loupeMap || !pointerActive) return;
      const lngLat = map.unproject([pointerX, pointerY]);
      loupeMap.jumpTo({
        center: [lngLat.lng, lngLat.lat],
        zoom: Math.min(MAP_DEFAULTS.maxZoom, map.getZoom() + LOUPE_ZOOM_DELTA),
      });
    }

    // ── Mobile touch: iOS-style pin-placement pattern ─────────────
    // (Desktop has no loupe — was distracting while drawing with the
    // mouse, and the imagery is sharper at 1x anyway. Re-add only if
    // we get a touchscreen-laptop request later.)
    //   • Quick tap → no loupe, gl-draw / gate handler processes it
    //   • Quick drag → no loupe, Mapbox pans normally
    //   • Long-press without movement → enter loupe mode (250ms),
    //     map pan disabled, loupe follows finger
    //   • Release in loupe mode → drop vertex (or snap gate) at
    //     the loupe target lat/lng
    //   • Pinch / second finger → cancel loupe, multi-touch handled by Mapbox
    function enterLoupeMode() {
      if (touchPhase === "loupe") return;
      touchPhase = "loupe";
      map.dragPan.disable();
      pointerActive = true;
      positionLoupeWrapper(pointerX, pointerY);
      updateLoupeContent();
      setLoupeVisible(true);
      // Snap the rubber-band phantom to the finger right away (see the
      // synthetic mousemove note in the touchmove handler).
      map.fire("mousemove", syntheticMouseEvent("mousemove"));
    }
    function exitLoupeMode() {
      pointerActive = false;
      setLoupeVisible(false);
      map.dragPan.enable();
    }

    // Drop helper — place a vertex (or gate) at the loupe target.
    //
    // IMPORTANT: gl-draw v1.5 does NOT subscribe to the map's "click"
    // event. Its src/events.js binds only mousemove/mousedown/mouseup +
    // touchstart/touchmove/touchend and synthesizes its own click from a
    // mousedown→mouseup pair (lib/is_click.js) or its own tap from a
    // touchstart→touchend pair (lib/is_tap.js, tolerance 25px / 250ms).
    // A loupe release always fails isTap (the long-press alone exceeds
    // the 250ms interval), so the ONLY way to make draw_line_string
    // append a vertex without manual feature surgery is a synthetic
    // mousedown+mouseup pair at the same point and time — isClick()
    // passes on zero movement and currentMode.click() runs.
    //
    // The trailing "click" fire is for OUR gate-mode handler, which is a
    // plain map.on("click") listener. In place_gate mode the down/up
    // pair hits gl-draw's no-op handlers, so both paths stay isolated.
    function syntheticMouseEvent(domType: string) {
      const lngLat = map.unproject([pointerX, pointerY]);
      // Mapbox's MapMouseEvent type insists on the full event surface
      // (preventDefault, defaultPrevented, etc.), but at runtime gl-draw
      // and our gate handler only read `lngLat` / `point` /
      // `originalEvent`. Cast through unknown for a minimal payload.
      return {
        lngLat,
        point: new mapboxgl.Point(pointerX, pointerY),
        originalEvent: new MouseEvent(domType, {
          button: 0,
          buttons: domType === "mousedown" ? 1 : 0,
        }),
      } as unknown as mapboxgl.MapMouseEvent;
    }
    function dropAtLoupeTarget() {
      map.fire("mousedown", syntheticMouseEvent("mousedown"));
      map.fire("mouseup", syntheticMouseEvent("mouseup"));
      map.fire("click", syntheticMouseEvent("click"));
    }

    map.on("touchstart", (e) => {
      if (e.points.length > 1) {
        if (touchPhase === "loupe") exitLoupeMode();
        touchPhase = "idle";
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        return;
      }
      // Defensive: if a touchend was ever swallowed while in loupe mode
      // (notification shade, browser gesture, tab switch), touchPhase
      // would still read "loupe" with dragPan disabled — and without
      // this exit, the next single-finger touch would flip to "pending"
      // while leaving the map permanently un-pannable.
      if (touchPhase === "loupe") exitLoupeMode();
      touchPhase = "pending";
      touchStartX = e.point.x;
      touchStartY = e.point.y;
      pointerX = e.point.x;
      pointerY = e.point.y;
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        if (touchPhase === "pending") enterLoupeMode();
      }, LOUPE_LONG_PRESS_MS);
    });
    map.on("touchmove", (e) => {
      if (e.points.length > 1) {
        if (touchPhase === "loupe") exitLoupeMode();
        touchPhase = "idle";
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        return;
      }
      pointerX = e.point.x;
      pointerY = e.point.y;
      if (touchPhase === "pending") {
        const dx = pointerX - touchStartX;
        const dy = pointerY - touchStartY;
        if (Math.hypot(dx, dy) > LOUPE_PAN_ABORT_PX) {
          // User moved before the long-press window completed — it's a
          // pan, not a loupe-summon. Cancel the timer and let Mapbox
          // handle the gesture as usual.
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
          touchPhase = "idle";
        }
      }
      if (touchPhase === "loupe") {
        positionLoupeWrapper(pointerX, pointerY);
        updateLoupeContent();
        // gl-draw's draw_line_string mode has NO onTouchMove — only
        // onMouseMove updates the phantom cursor-follower. Fire a
        // synthetic mousemove (buttons: 0 so gl-draw's events.mousemove
        // doesn't reroute it into its drag path) so the rubber-band
        // line from the last vertex tracks the loupe target live.
        map.fire("mousemove", syntheticMouseEvent("mousemove"));
      }
    });
    map.on("touchend", (e) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      if (touchPhase === "loupe") {
        dropAtLoupeTarget();
        exitLoupeMode();
        // Suppress the compatibility mouse events (incl. click) the
        // browser fires after touchend (W3C touch-events §13.5), so the
        // gate-mode click handler can't double-fire at the touchend
        // position on top of the synthetic drop above. NOTE: Mapbox's
        // MapTouchEvent.preventDefault() only suppresses Mapbox's OWN
        // default handlers — it never reaches the DOM event. gl-draw's
        // touchend listener happens to preventDefault the DOM event
        // unconditionally, but don't depend on a third-party side
        // effect: call it on the originalEvent explicitly.
        e.originalEvent?.preventDefault?.();
        e.preventDefault();
      }
      touchPhase = "idle";
    });
    map.on("touchcancel", () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      if (touchPhase === "loupe") exitLoupeMode();
      touchPhase = "idle";
    });

    // Re-derive loupe content on every map render. During a pan, the
    // finger's screen position stays roughly the same but the geography
    // beneath it shifts — without this listener the loupe would lock
    // onto whatever was under the finger at touchstart.
    map.on("render", () => {
      if (pointerActive) updateLoupeContent();
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
        loupeRo?.disconnect();
        if (longPressTimer) clearTimeout(longPressTimer);
        // Make sure dragPan isn't left disabled if we unmount mid-loupe.
        try {
          map.dragPan.enable();
        } catch {
          // map already removed below — ignore
        }
        loupeMapRef.current?.remove();
        map.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
      drawRef.current = null;
      loupeMapRef.current = null;
    };
    // Center change after mount is intentional — recreating the map on every
    // pan would lose the in-progress geometry. Quote address is fixed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync parcel-boundary overlay ─────────────────────────────────
  // Renders a dashed cyan outline of the property parcel so the user can see
  // where the lot line is before drawing. Mirrored onto the loupe map so
  // the magnifier shows property lines too.
  useEffect(() => {
    const PARCEL_SOURCE = "qos-parcel";
    const PARCEL_LAYER = "qos-parcel-outline";

    function applyOverlayTo(targetMap: mapboxgl.Map) {
      if (!parcelBoundary) {
        if (targetMap.getLayer(PARCEL_LAYER)) targetMap.removeLayer(PARCEL_LAYER);
        if (targetMap.getSource(PARCEL_SOURCE)) targetMap.removeSource(PARCEL_SOURCE);
        return;
      }
      const data: GeoJSON.Feature = {
        type: "Feature",
        properties: {},
        geometry: parcelBoundary as GeoJSON.Polygon | GeoJSON.MultiPolygon,
      };
      const existing = targetMap.getSource(PARCEL_SOURCE) as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (existing) {
        existing.setData(data);
        return;
      }
      targetMap.addSource(PARCEL_SOURCE, { type: "geojson", data });
      // Insert before the first gl-draw layer if present (main map only;
      // loupe has no gl-draw, so beforeId stays undefined and layer sits on top).
      const beforeId = targetMap
        .getStyle()
        .layers?.find((l) => l.id.startsWith("gl-draw"))?.id;
      targetMap.addLayer(
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

    function applyWhenReady(targetMap: mapboxgl.Map | null) {
      if (!targetMap) return;
      if (targetMap.isStyleLoaded()) applyOverlayTo(targetMap);
      else targetMap.once("style.load", () => applyOverlayTo(targetMap));
    }

    applyWhenReady(mapRef.current);
    applyWhenReady(loupeMapRef.current);
  }, [parcelBoundary]);

  // ── Sync adjacent-parcel outlines ────────────────────────────────
  // Renders all neighbor parcels as a fainter dashed line so the customer
  // can see the full block context. Mirrored onto the loupe map.
  useEffect(() => {
    const SOURCE = "qos-adjacent-parcels";
    const LAYER = "qos-adjacent-parcels-line";

    function applyOverlayTo(targetMap: mapboxgl.Map) {
      if (!adjacentBoundaries || adjacentBoundaries.length === 0) {
        if (targetMap.getLayer(LAYER)) targetMap.removeLayer(LAYER);
        if (targetMap.getSource(SOURCE)) targetMap.removeSource(SOURCE);
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
      const existing = targetMap.getSource(SOURCE) as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (existing) {
        existing.setData(data);
        return;
      }
      const layers = targetMap.getStyle().layers ?? [];
      const beforeId =
        layers.find((l) => l.id === "qos-parcel-outline")?.id ??
        layers.find((l) => l.id.startsWith("gl-draw"))?.id;
      targetMap.addLayer(
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

    function applyWhenReady(targetMap: mapboxgl.Map | null) {
      if (!targetMap) return;
      if (targetMap.isStyleLoaded()) applyOverlayTo(targetMap);
      else targetMap.once("style.load", () => applyOverlayTo(targetMap));
    }

    applyWhenReady(mapRef.current);
    applyWhenReady(loupeMapRef.current);
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

  // ── Sync endpoint trim handles ──────────────────────────────────
  // Two large draggable dots riding the traced line's endpoints. During
  // a drag we report "move" with the raw finger position — the page
  // snaps it onto the chain and rewrites the line live, so the dot can
  // wander while the FENCE stays magnetized to the lot line. On
  // release ("end") the page snaps the handle position itself, which
  // re-runs this effect and re-seats the dot exactly on the line.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of trimMarkersRef.current) m.remove();
    trimMarkersRef.current = [];
    if (!trimHandles || trimHandles.length === 0) return;

    trimHandles.forEach((h, idx) => {
      const el = document.createElement("div");
      el.setAttribute(
        "aria-label",
        idx === 0 ? "Fence start — drag to adjust" : "Fence end — drag to adjust"
      );
      // 44px touch target wrapping a 26px visible dot.
      el.style.cssText =
        "width:44px;height:44px;display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;";
      const dot = document.createElement("div");
      dot.style.cssText =
        "width:26px;height:26px;border-radius:50%;background:#F4A623;border:3px solid #FAF1E0;box-shadow:0 2px 12px rgba(11,28,50,0.5);";
      // Gentle pulse for discoverability until the first grab.
      dot.classList.add("animate-pulse");
      el.appendChild(dot);

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "center",
        draggable: true,
      })
        .setLngLat([h.lng, h.lat])
        .addTo(map);

      marker.on("dragstart", () => {
        dot.classList.remove("animate-pulse");
        el.style.cursor = "grabbing";
      });
      marker.on("drag", () => {
        const ll = marker.getLngLat();
        onTrimHandleDragRef.current?.(idx, { lat: ll.lat, lng: ll.lng }, "move");
      });
      marker.on("dragend", () => {
        el.style.cursor = "grab";
        const ll = marker.getLngLat();
        onTrimHandleDragRef.current?.(idx, { lat: ll.lat, lng: ll.lng }, "end");
      });

      trimMarkersRef.current.push(marker);
    });

    return () => {
      for (const m of trimMarkersRef.current) m.remove();
      trimMarkersRef.current = [];
    };
  }, [trimHandles]);

  // ── Gate placement mode: switch draw to simple_select, intercept clicks ──
  useEffect(() => {
    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw) return;

    if (!gatePlacementMode) {
      // Returning to drawing — restore line mode unless polygon is in progress
      console.info("[FenceMap] exiting gate mode → restore draw_line_string");
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
    console.info("[FenceMap] entering gate mode → changeMode(place_gate)");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (draw as any).changeMode("place_gate");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const after = (draw as any).getMode?.();
      console.info(`[FenceMap] mode is now: ${after}`);
      const fc = draw.getAll();
      console.info(
        `[FenceMap] features in collection: ${fc.features.length} (post-mode-change)`
      );
    } catch (err) {
      console.error("[FenceMap] gate-mode changeMode failed:", err);
    }

    // Visual cue: the map cursor turns to crosshair while in placement mode
    // so the user understands "tap somewhere" rather than the default arrow.
    const canvas = map.getCanvas();
    const prevCursor = canvas.style.cursor;
    canvas.style.cursor = "crosshair";

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      console.info(
        `[FenceMap] gate-mode map.click fired at lng=${e.lngLat.lng.toFixed(6)}, lat=${e.lngLat.lat.toFixed(6)}`
      );
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

    // Belt-and-suspenders: also bind a pointerup listener directly on the
    // canvas in case Mapbox's 'click' event ever gets eaten (custom mode,
    // draw plugin quirk, mobile browser oddity). Dedupe: the browser
    // dispatches pointerup BEFORE click, so a simple "did map.click just
    // fire?" timestamp check is always too early. Instead we DEFER the
    // fallback by ~150ms; if map.click fires inside that window it
    // cancels the timer. Net result: map.click handles 99% of taps,
    // pointerup only takes over when Mapbox truly missed the event.
    let pendingFallback: ReturnType<typeof setTimeout> | null = null;
    const onCanvasPointerUp = (ev: PointerEvent) => {
      // Only left-button / primary touch — ignore right-click + middle.
      if (ev.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const lngLat = map.unproject([x, y]);
      if (pendingFallback != null) clearTimeout(pendingFallback);
      pendingFallback = setTimeout(() => {
        pendingFallback = null;
        console.info(
          `[FenceMap] gate-mode canvas.pointerup fallback at lng=${lngLat.lng.toFixed(6)}, lat=${lngLat.lat.toFixed(6)}`
        );
        handleClick({ lngLat } as unknown as mapboxgl.MapMouseEvent);
      }, 150);
    };
    // map.click is the primary path — cancel any pending pointerup fallback.
    const cancelPendingFallback = () => {
      if (pendingFallback != null) {
        clearTimeout(pendingFallback);
        pendingFallback = null;
      }
    };
    map.on("click", cancelPendingFallback);
    canvas.addEventListener("pointerup", onCanvasPointerUp);

    return () => {
      map.off("click", handleClick);
      map.off("click", cancelPendingFallback);
      canvas.removeEventListener("pointerup", onCanvasPointerUp);
      if (pendingFallback != null) clearTimeout(pendingFallback);
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
      // Pick the feature with the most coordinates — the SAME heuristic
      // emitStats uses. Using "most recent feature" here meant the exact
      // edge case emitStats guards against (a 1-vertex stub created by
      // mode-thrash sitting as the newest entry) made Undo operate on
      // the stub while the readout reflected the real fence.
      let feature: Feature<LineString | Polygon> | null = null;
      let bestCount = -1;
      for (const f of all.features) {
        const g = f.geometry;
        const c =
          g.type === "Polygon"
            ? g.coordinates[0].length
            : g.type === "LineString"
              ? g.coordinates.length
              : -1;
        if (c > bestCount) {
          bestCount = c;
          feature = f as Feature<LineString | Polygon>;
        }
      }
      if (!feature) return;
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
        // Resume drawing from the new last vertex so the user can keep going.
        // gl-draw v1.4+ throws "Please use the `from` property to indicate
        // which point to continue the line from" if `from` is omitted, so
        // pass the last remaining coord explicitly.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (draw as any).changeMode("draw_line_string", {
          featureId: id,
          from: newCoords[newCoords.length - 1],
        });
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
    loadFeature(feature) {
      const draw = drawRef.current;
      if (!draw) return;
      draw.deleteAll();
      const [id] = draw.add({
        type: "Feature",
        properties: {},
        geometry: feature.geometry,
      });
      loadedFeatureIdRef.current = id;
      if (feature.geometry.type === "LineString") {
        const coords = feature.geometry.coordinates;
        // Resume drawing from the chain's end so the next tap extends it
        // and Undo trims it — same affordances as a hand-drawn line.
        // changeMode fires draw.modechange, which re-runs emitStats, so
        // the page readout updates without a manual emit.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (draw as any).changeMode("draw_line_string", {
          featureId: id,
          from: coords[coords.length - 1],
        });
      } else {
        // Closed polygon — complete as-is. Ring length is always ≥ 5 for
        // a traced lot, so the simple_select auto-recovery (which only
        // bounces rings shorter than 4) leaves it alone.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (draw as any).changeMode("simple_select");
      }
    },
    loadFeatureStatic(feature) {
      const draw = drawRef.current;
      if (!draw) return;
      draw.deleteAll();
      const [id] = draw.add({
        type: "Feature",
        properties: {},
        geometry: feature.geometry,
      });
      loadedFeatureIdRef.current = id;
      // place_gate is our registered render-only mode: features draw,
      // every interaction is a no-op, and gl-draw holds no per-mode
      // drawing state — so setFeatureCoords can rewrite geometry on
      // every drag frame without desyncing anything. (Mode name is a
      // legacy of gate placement; it's really "static but visible".)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (draw as any).changeMode("place_gate");
    },
    setFeatureCoords(coords) {
      const draw = drawRef.current;
      if (!draw || coords.length < 2) return;
      const id = loadedFeatureIdRef.current;
      if (!id) return;
      // gl-draw's add() with an existing id replaces that feature's
      // geometry in place (documented API behavior).
      draw.add({
        type: "Feature",
        id,
        properties: {},
        geometry: { type: "LineString", coordinates: coords },
      });
    },
    resumeLine() {
      const draw = drawRef.current;
      if (!draw) return;
      const fc = draw.getAll();
      let line: Feature<LineString> | null = null;
      let best = -1;
      for (const f of fc.features) {
        if (f.geometry.type !== "LineString") continue;
        if (f.geometry.coordinates.length > best) {
          best = f.geometry.coordinates.length;
          line = f as Feature<LineString>;
        }
      }
      if (!line || line.id == null || best < 2) return;
      const coords = line.geometry.coordinates;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (draw as any).changeMode("draw_line_string", {
          featureId: line.id,
          from: coords[coords.length - 1],
        });
      } catch (err) {
        console.warn("[FenceMap] resumeLine failed", err);
      }
    },
    getFinalFeature() {
      const draw = drawRef.current;
      if (!draw) return null;
      const fc = draw.getAll();
      // Most-coords primary — same heuristic as emitStats/undo.
      let primary: Feature<LineString | Polygon> | null = null;
      let bestCount = -1;
      for (const f of fc.features) {
        const g = f.geometry;
        const c =
          g.type === "Polygon"
            ? g.coordinates[0].length
            : g.type === "LineString"
              ? g.coordinates.length
              : -1;
        if (c > bestCount) {
          bestCount = c;
          primary = f as Feature<LineString | Polygon>;
        }
      }
      if (!primary) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mode = (draw as any).getMode?.() as string | undefined;
      let geometry: LineString | Polygon;
      if (primary.geometry.type === "LineString") {
        const coords = primary.geometry.coordinates;
        const clean =
          mode === "draw_line_string" && coords.length >= 2
            ? coords.slice(0, -1)
            : coords;
        if (clean.length < 2) return null;
        geometry = { type: "LineString", coordinates: clean };
      } else {
        const ring = primary.geometry.coordinates[0];
        if (mode === "draw_polygon" && ring.length >= 5) {
          // Strip the phantom (just before the closing duplicate).
          const clean = ring.slice(0, ring.length - 2).concat([ring[0]]);
          geometry = { type: "Polygon", coordinates: [clean] };
        } else {
          geometry = { type: "Polygon", coordinates: [ring] };
        }
      }
      const feature: Feature<LineString | Polygon> = {
        type: "Feature",
        properties: primary.properties ?? {},
        geometry,
      };
      return {
        feature,
        linear_feet: geometryLF(feature),
        corner_count: cornerCount(feature),
      };
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
      {/* Zoom loupe — circular magnifier that follows the cursor (desktop)
          or finger (mobile, after a small drag). Hidden by default;
          opacity is toggled in the pointer/touch handlers above. Position
          is set imperatively via transform on the wrapper ref. Sized
          and styled inline so it survives Tailwind JIT misses. */}
      <div
        ref={loupeWrapperRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 160,
          height: 160,
          borderRadius: "50%",
          overflow: "hidden",
          border: "3px solid #FAF1E0",
          backgroundColor: "rgba(11, 28, 50, 0.15)",
          boxShadow: "0 10px 28px rgba(11, 28, 50, 0.35)",
          pointerEvents: "none",
          zIndex: 20,
          opacity: 0,
          transition: "opacity 90ms ease-out",
          willChange: "transform, opacity",
          transform: "translate3d(-9999px, -9999px, 0)",
        }}
        aria-hidden="true"
      >
        <div
          ref={loupeContainerRef}
          style={{ width: "100%", height: "100%" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{ position: "relative", width: 22, height: 22 }}>
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 0,
                height: "100%",
                width: 1,
                transform: "translateX(-50%)",
                backgroundColor: "#B23B2A",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                top: "50%",
                width: "100%",
                height: 1,
                transform: "translateY(-50%)",
                backgroundColor: "#B23B2A",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 6,
                height: 6,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                border: "1px solid #B23B2A",
                backgroundColor: "#FAF1E0",
              }}
            />
          </div>
        </div>
      </div>
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

