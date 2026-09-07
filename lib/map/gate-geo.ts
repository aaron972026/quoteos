import nearestPointOnLine from "@turf/nearest-point-on-line";
import { lineString as turfLineString, point as turfPoint } from "@turf/helpers";
import type { Position } from "geojson";
import { runLF } from "./draw-state";

/**
 * Pure geo helpers shared by the gates UI (FenceMap gesture + marker render).
 * A gate lives on a segment a→b at a CENTRE offset in feet from `a`. These two
 * functions convert between that offset and a map coordinate, and are the
 * inverse of each other for a straight segment (the only kind a fence segment
 * ever is).
 */

const FEET_PER_MILE = 5280;

/**
 * The [lng, lat] at `offset_ft` measured from `a` toward `b`. Linear
 * interpolation of the fraction offset/segLen — exact enough at fence scale
 * (segments are tens of feet; the geodesic-vs-planar drift is sub-millimetre)
 * and the clean inverse of pointToOffset. The offset is clamped to
 * [0, segLen] so the returned point never leaves the segment.
 */
export function offsetToCoord(a: Position, b: Position, offset_ft: number): Position {
  const segLen = runLF([a, b]);
  if (segLen <= 0) return [a[0], a[1]];
  const t = Math.min(Math.max(offset_ft / segLen, 0), 1);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Feet from `a` to the projection of `p` onto segment a→b, clamped to the
 * segment. Uses turf's nearest-point-on-line (miles × 5280) so the value is
 * geodesic and consistent with segmentLengthFt / runLF.
 */
export function pointToOffset(a: Position, b: Position, p: Position): number {
  const snapped = nearestPointOnLine(
    turfLineString([a, b]),
    turfPoint([p[0], p[1]]),
    { units: "miles" }
  );
  const miles = (snapped.properties.location as number | undefined) ?? 0;
  return miles * FEET_PER_MILE;
}
