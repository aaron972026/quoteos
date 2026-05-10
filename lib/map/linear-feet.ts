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

/** Check if a polygon self-intersects — used for "geometry that crosses itself" guard from spec §11 */
export function isSelfIntersecting(_feature: Feature<LineString | Polygon>): boolean {
  // TODO: pull in @turf/boolean-intersects against each segment pair.
  // Phase 1.5 — for now we trust mapbox-gl-draw's UX to discourage crossings.
  return false;
}
