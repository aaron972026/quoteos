import length from "@turf/length";
import type { Feature, LineString, Polygon, Position } from "geojson";

const FEET_PER_MILE = 5280;

/**
 * Linear feet of a drawn fence — works for open LineString or closed Polygon.
 * Polygons measure the perimeter of the outer ring.
 */
export function geometryLF(
  feature: Feature<LineString | Polygon> | LineString | Polygon | null | undefined
): number {
  if (!feature) return 0;
  const geom = "geometry" in feature ? feature.geometry : feature;
  let coords: Position[];
  if (geom.type === "Polygon") {
    coords = geom.coordinates[0];
  } else if (geom.type === "LineString") {
    coords = geom.coordinates;
  } else {
    return 0;
  }
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
 * Corner count per spec §6:
 *  - Open LineString: each vertex except start and end is a corner
 *  - Closed Polygon: every unique vertex is a corner
 */
export function cornerCount(
  feature: Feature<LineString | Polygon> | LineString | Polygon | null | undefined
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
  return 0;
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
  feature: Feature<LineString | Polygon> | LineString | Polygon
): boolean {
  const geom = "geometry" in feature ? feature.geometry : feature;
  const isPolygon = geom.type === "Polygon";
  const coords: Position[] = isPolygon
    ? geom.coordinates[0]
    : geom.coordinates;
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
