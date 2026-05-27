import distance from "@turf/distance";
import { point as turfPoint } from "@turf/helpers";
import type { Feature, LineString, Polygon, Position } from "geojson";

export interface ElevationSample {
  position: Position; // [lng, lat]
  elevation_m: number | null;
}

export interface SlopeDetectionResult {
  /** Maximum sustained grade between any pair of adjacent samples (percent). */
  max_grade_pct: number;
  /** Engine slope_code 0..4, matching `SLOPE` keys in lib/pricing/data.ts. */
  slope_code: 0 | 1 | 2 | 3 | 4;
  /** How many samples actually got an elevation back. */
  resolved_samples: number;
  /** Total samples requested (some Mapbox queries may have failed). */
  total_samples: number;
}

/**
 * Sample N evenly-spaced points along an open or closed line. Uses linear
 * interpolation in lng/lat — accurate at fence-scale distances (<1000ft).
 * Always includes the first and last coordinate.
 */
export function sampleLineEvenly(
  geom: Feature<LineString | Polygon> | LineString | Polygon,
  n: number
): Position[] {
  if (n < 2) throw new Error("n must be >= 2");
  const inner = "geometry" in geom ? geom.geometry : geom;
  const coords: Position[] =
    inner.type === "Polygon" ? inner.coordinates[0] : inner.coordinates;
  if (coords.length < 2) return [];

  // Cumulative distance (km) along the polyline
  const cum: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const d = distance(
      turfPoint(coords[i - 1] as [number, number]),
      turfPoint(coords[i] as [number, number]),
      { units: "kilometers" }
    );
    cum.push(cum[i - 1] + d);
  }
  const total = cum[cum.length - 1];
  if (total === 0) return [coords[0]];

  const step = total / (n - 1);
  const samples: Position[] = [coords[0]];
  let segIdx = 0;
  for (let i = 1; i < n - 1; i++) {
    const target = step * i;
    while (segIdx < cum.length - 2 && cum[segIdx + 1] < target) segIdx++;
    const segStart = coords[segIdx];
    const segEnd = coords[segIdx + 1];
    const segLen = cum[segIdx + 1] - cum[segIdx];
    const t = segLen === 0 ? 0 : (target - cum[segIdx]) / segLen;
    samples.push([
      segStart[0] + t * (segEnd[0] - segStart[0]),
      segStart[1] + t * (segEnd[1] - segStart[1]),
    ]);
  }
  samples.push(coords[coords.length - 1]);
  return samples;
}

/**
 * Classify a grade percentage into an engine slope_code. Thresholds match
 * the `SLOPE` table in lib/pricing/data.ts.
 */
export function classifyGrade(gradePct: number): 0 | 1 | 2 | 3 | 4 {
  if (gradePct < 5) return 0;   // Flat
  if (gradePct < 10) return 1;  // Mild
  if (gradePct < 20) return 2;  // Moderate
  if (gradePct < 30) return 3;  // Severe
  return 4;                     // Extreme
}

/**
 * Walk adjacent sample pairs and return the steepest sustained grade.
 *
 * Why "max segment" instead of "(maxEle − minEle) / totalRun":
 *  - A run that goes up then down has small overall drop but real cost.
 *  - Fence cost is driven by steep sections, not net displacement.
 *
 * Samples whose elevation didn't resolve are skipped; if fewer than 2 valid
 * pairs remain, returns 0 (flat) — caller decides whether to fall back to
 * the self-reported value.
 */
export function gradeFromSamples(samples: ElevationSample[]): SlopeDetectionResult {
  let maxGrade = 0;
  let resolved = 0;
  for (const s of samples) if (s.elevation_m != null) resolved++;

  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (a.elevation_m == null || b.elevation_m == null) continue;
    const horizKm = distance(
      turfPoint(a.position as [number, number]),
      turfPoint(b.position as [number, number]),
      { units: "kilometers" }
    );
    if (horizKm === 0) continue;
    const horizM = horizKm * 1000;
    const grade = (Math.abs(b.elevation_m - a.elevation_m) / horizM) * 100;
    if (grade > maxGrade) maxGrade = grade;
  }

  return {
    max_grade_pct: Math.round(maxGrade * 10) / 10,
    slope_code: classifyGrade(maxGrade),
    resolved_samples: resolved,
    total_samples: samples.length,
  };
}
