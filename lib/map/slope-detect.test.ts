import { describe, expect, it } from "vitest";
import {
  classifyGrade,
  gradeFromSamples,
  sampleLineEvenly,
  type ElevationSample,
} from "./slope-detect";
import type { LineString } from "geojson";

const STRAIGHT_LINE: LineString = {
  type: "LineString",
  // ~100m east-west at Tulsa latitude (36°N)
  coordinates: [
    [-95.99000, 36.15000],
    [-95.98889, 36.15000],
  ],
};

describe("classifyGrade", () => {
  it.each([
    [0, 0],
    [4.99, 0],
    [5, 1],
    [9.99, 1],
    [10, 2],
    [19.99, 2],
    [20, 3],
    [29.99, 3],
    [30, 4],
    [50, 4],
  ])("grade %s%% -> code %s", (pct, expected) => {
    expect(classifyGrade(pct)).toBe(expected);
  });
});

describe("sampleLineEvenly", () => {
  it("returns endpoints when n=2", () => {
    const s = sampleLineEvenly(STRAIGHT_LINE, 2);
    expect(s).toHaveLength(2);
    expect(s[0]).toEqual(STRAIGHT_LINE.coordinates[0]);
    expect(s[1]).toEqual(STRAIGHT_LINE.coordinates[1]);
  });

  it("places mid-sample at the line midpoint for n=3", () => {
    const s = sampleLineEvenly(STRAIGHT_LINE, 3);
    expect(s).toHaveLength(3);
    const midLng = (STRAIGHT_LINE.coordinates[0][0] + STRAIGHT_LINE.coordinates[1][0]) / 2;
    expect(s[1][0]).toBeCloseTo(midLng, 5);
  });

  it("returns N samples for a multi-segment line", () => {
    const line: LineString = {
      type: "LineString",
      coordinates: [
        [-95.99, 36.15],
        [-95.98, 36.15],
        [-95.98, 36.14],
      ],
    };
    expect(sampleLineEvenly(line, 10)).toHaveLength(10);
  });
});

describe("gradeFromSamples", () => {
  it("returns flat (code 0) for level ground", () => {
    const samples: ElevationSample[] = [
      { position: [-95.99, 36.15], elevation_m: 200 },
      { position: [-95.98889, 36.15], elevation_m: 200 },
    ];
    const r = gradeFromSamples(samples);
    expect(r.slope_code).toBe(0);
    expect(r.max_grade_pct).toBe(0);
  });

  it("detects a steep grade (10m rise over ~100m run -> 10%)", () => {
    const samples: ElevationSample[] = [
      { position: [-95.99000, 36.15], elevation_m: 200 },
      { position: [-95.98889, 36.15], elevation_m: 210 },
    ];
    const r = gradeFromSamples(samples);
    expect(r.slope_code).toBe(2); // 10% is moderate
    expect(r.max_grade_pct).toBeGreaterThanOrEqual(9);
    expect(r.max_grade_pct).toBeLessThanOrEqual(11);
  });

  it("skips unresolved samples without crashing", () => {
    const samples: ElevationSample[] = [
      { position: [-95.99, 36.15], elevation_m: null },
      { position: [-95.98889, 36.15], elevation_m: 200 },
      { position: [-95.98778, 36.15], elevation_m: 201 },
    ];
    const r = gradeFromSamples(samples);
    expect(r.resolved_samples).toBe(2);
    expect(r.total_samples).toBe(3);
    expect(r.slope_code).toBe(0);
  });

  it("picks the max grade across a non-monotonic profile", () => {
    // Up gently, then down steeply
    const samples: ElevationSample[] = [
      { position: [-95.99000, 36.15], elevation_m: 200 },
      { position: [-95.98944, 36.15], elevation_m: 202 }, // +2m over 50m = 4%
      { position: [-95.98889, 36.15], elevation_m: 188 }, // -14m over 50m = 28%
    ];
    const r = gradeFromSamples(samples);
    expect(r.slope_code).toBe(3); // severe (28% falls in 20-30)
  });
});
