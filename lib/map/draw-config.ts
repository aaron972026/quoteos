/**
 * Custom mapbox-gl-draw style array that paints fence geometry in our brand
 * orange (#F4A623) over the satellite imagery, with prominent vertex handles
 * for tap-to-edit on mobile.
 */
const ACCENT = "#F4A623";
const ACCENT_DARK = "#D38A0E";
const NAVY = "#1F3A5F";

export const fenceDrawStyles: object[] = [
  // ── Inactive / styled lines ──────────────────────────────────────
  {
    id: "qos-line-inactive",
    type: "line",
    filter: [
      "all",
      ["==", "$type", "LineString"],
      ["!=", "mode", "static"],
      ["!=", "active", "true"],
    ],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ACCENT,
      "line-width": 4,
    },
  },
  {
    id: "qos-line-active",
    type: "line",
    filter: ["all", ["==", "$type", "LineString"], ["==", "active", "true"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ACCENT,
      "line-dasharray": [0.4, 1.6],
      "line-width": 4,
    },
  },

  // ── Polygon fill ─────────────────────────────────────────────────
  {
    id: "qos-poly-fill",
    type: "fill",
    filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
    paint: {
      "fill-color": ACCENT,
      "fill-opacity": 0.12,
    },
  },
  {
    id: "qos-poly-stroke",
    type: "line",
    filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ACCENT,
      "line-width": 4,
    },
  },

  // ── Vertices (the draggable corner dots) ─────────────────────────
  {
    id: "qos-vertex-halo",
    type: "circle",
    filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
    paint: {
      "circle-radius": 9,
      "circle-color": "#fff",
      "circle-stroke-color": ACCENT,
      "circle-stroke-width": 3,
    },
  },
  {
    id: "qos-vertex",
    type: "circle",
    filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
    paint: {
      "circle-radius": 4,
      "circle-color": ACCENT_DARK,
    },
  },

  // ── Midpoint handles (drag to insert new vertex) ─────────────────
  {
    id: "qos-midpoint",
    type: "circle",
    filter: ["all", ["==", "meta", "midpoint"], ["==", "$type", "Point"]],
    paint: {
      "circle-radius": 5,
      "circle-color": NAVY,
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2,
    },
  },
];

// Map style — satellite per spec §6
// satellite-v9 is raster-only imagery (no street/POI vector overlays). The
// streets-v12 variant ~triples tile fetches and is much slower over a typical
// home wifi. Imagery alone is enough for this UX.
export const SATELLITE_STYLE = "mapbox://styles/mapbox/satellite-v9";

export const MAP_DEFAULTS = {
  zoom: 19,
  minZoom: 17,
  maxZoom: 21,
  pitchWithRotate: false,
  dragRotate: false,
  pitch: 0,
  bearing: 0,
};

// CSS class applied to the HTML element used as a Mapbox Marker for gates.
// Style lives in app/globals.css so it survives marker re-rendering.
export const GATE_MARKER_CLASS = "qos-gate-marker";

// Maximum distance (km) between a tap and the line for "snap" to succeed.
// ~0.020 km = 20 m ≈ 65 ft. Finger taps on phones are ~40-60px wide and
// users don't aim precisely — too tight a tolerance silently rejected
// real taps. Still rejects clearly-off taps (across the yard).
export const GATE_SNAP_MAX_KM = 0.02;
