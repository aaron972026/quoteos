import length from "@turf/length";
import type {
  Feature,
  LineString,
  MultiLineString,
  Polygon,
  Position,
} from "geojson";

const FEET_PER_MILE = 5280;

type DrawGeom = LineString | MultiLineString | Polygon;

/** LF of a single ordered coordinate list. */
function coordsLF(coords: Position[]): number {
  if (coords.length < 2) return 0;
  const lineFeature: Feature<LineString> = {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords },
  };
  const miles = length(lineFeature, { units: "miles" });
  return Math.round(miles * FEET_PER_MILE * 100) / 100; // 2 decimals
}

/**
 * Linear feet of a drawn fence:
 *  - LineString: length of the run
 *  - MultiLineString: sum of every run (disconnected sections / branches)
 *  - Polygon: perimeter of the outer ring
 */
export function geometryLF(
  feature: Feature<DrawGeom> | DrawGeom | null | undefined
): number {
  if (!feature) return 0;
  const geom = "geometry" in feature ? feature.geometry : feature;
  if (geom.type === "Polygon") return coordsLF(geom.coordinates[0]);
  if (geom.type === "LineString") return coordsLF(geom.coordinates);
  if (geom.type === "MultiLineString") {
    // Sum in integer cents so Σ(runs) === total exactly (parity guarantee).
    const cents = geom.coordinates.reduce(
      (sum, run) => sum + Math.round(coordsLF(run) * 100),
      0
    );
    return Math.round(cents) / 100;
  }
  return 0;
}

/**
 * Corner count per spec §6:
 *  - Open LineString: each vertex except start and end is a corner
 *  - Closed Polygon: every unique vertex is a corner
 */
export function cornerCount(
  feature: Feature<DrawGeom> | DrawGeom | null | undefined
): number {
  if (!feature) return 0;
  const geom = "geometry" in feature ? feature.geometry : feature;
  if (geom.type === "Polygon") {
    // Outer ring includes the closing vertex (a copy of the first), so subtract 1
    return Math.max(0, geom.coordinates[0].length - 1);
  }
  if (geom.type === "LineString") {
    return Math.max(0, geom.coordinates.length - 2);
  }
  if (geom.type === "MultiLineString") {
    // Per-run interior vertices. A junction anchor is an endpoint of the branch
    // run (excluded by -2), so it's never double-counted as a corner.
    return geom.coordinates.reduce(
      (sum, run) => sum + Math.max(0, run.length - 2),
      0
    );
  }
  return 0;
}

/**
 * Distinct posts across all runs — shared junction coordinates count once, so
 * post/material metrics don't over-count a T-junction. Used for BOM/metrics,
 * not pricing (LF is length-based).
 */
export function uniquePostCount(
  feature: Feature<DrawGeom> | DrawGeom | null | undefined
): number {
  if (!feature) return 0;
  const geom = "geometry" in feature ? feature.geometry : feature;
  const runs: Position[][] =
    geom.type === "Polygon"
      ? [geom.coordinates[0]]
      : geom.type === "LineString"
        ? [geom.coordinates]
        : geom.type === "MultiLineString"
          ? geom.coordinates
          : [];
  const seen = new Set<string>();
  for (const run of runs) {
    for (const [lng, lat] of run) seen.add(`${lng},${lat}`);
  }
  return seen.size;
}

/**
 * Orientation of triple (a, b, c). >0 = counter-clockwise, <0 = clockwise, 0 = collinear.
 */
function orient(a: Position, b: Position, c: Position): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/**
 * True iff segments (p1, p2) and (p3, p4) properly cross each other's interior.
 * Collinear/touching-at-endpoint cases return false — they're the "shared
 * vertex" pattern between adjacent segments, not real self-intersections.
 *
 * Treats lng/lat as Cartesian — accurate at fence scale (<1000 ft).
 */
function segmentsCross(
  p1: Position,
  p2: Position,
  p3: Position,
  p4: Position
): boolean {
  const d1 = orient(p3, p4, p1);
  const d2 = orient(p3, p4, p2);
  const d3 = orient(p1, p2, p3);
  const d4 = orient(p1, p2, p4);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/**
 * Check if a drawn LineString or Polygon crosses itself (figure-8 pattern).
 * O(n²) over segment pairs — fine because fence draws have <30 segments.
 *
 * For polygons, the closing segment (last → first) is treated as adjacent to
 * the first segment, so closing the ring doesn't trip the check.
 */
export function isSelfIntersecting(
  feature: Feature<DrawGeom> | DrawGeom
): boolean {
  const geom = "geometry" in feature ? feature.geometry : feature;
  if (geom.type === "MultiLineString") {
    // Branches legitimately share endpoints (T-junctions), so only flag a run
    // that crosses ITSELF — never treat cross-run touches as intersections.
    return geom.coordinates.some((run) =>
      ringSelfIntersects(run as Position[], false)
    );
  }
  const isPolygon = geom.type === "Polygon";
  const coords: Position[] = isPolygon
    ? geom.coordinates[0]
    : geom.coordinates;
  return ringSelfIntersects(coords, isPolygon);
}

function ringSelfIntersects(coords: Position[], isPolygon: boolean): boolean {
  if (coords.length < 4) return false;

  // Polygons have a duplicated closing vertex; segment count is coords-1 for both
  const segCount = coords.length - 1;

  for (let i = 0; i < segCount - 1; i++) {
    for (let j = i + 2; j < segCount; j++) {
      // Polygons: segments 0 and (segCount-1) are adjacent through the closing
      // vertex, so skip that pair.
      if (isPolygon && i === 0 && j === segCount - 1) continue;
      if (
        segmentsCross(coords[i], coords[i + 1], coords[j], coords[j + 1])
      ) {
        return true;
      }
    }
  }
  return false;
}
