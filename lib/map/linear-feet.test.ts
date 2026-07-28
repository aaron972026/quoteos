import { describe, expect, it } from "vitest";
import {
  cornerCount,
  geometryLF,
  isSelfIntersecting,
  uniquePostCount,
} from "./linear-feet";
import type {
  Feature,
  LineString,
  MultiLineString,
  Polygon,
} from "geojson";

function line(coords: number[][]): Feature<LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords },
  };
}

function polygon(coords: number[][]): Feature<Polygon> {
  // Auto-close if caller didn't
  const ring =
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1]
      ? coords
      : [...coords, coords[0]];
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}

describe("isSelfIntersecting — LineString", () => {
  it("returns false for an L-shaped line", () => {
    expect(
      isSelfIntersecting(line([[0, 0], [10, 0], [10, 10]]))
    ).toBe(false);
  });

  it("returns false for a back-and-forth zigzag", () => {
    expect(
      isSelfIntersecting(
        line([[0, 0], [10, 0], [0, 1], [10, 1], [0, 2]])
      )
    ).toBe(false);
  });

  it("detects a classic figure-8 crossing", () => {
    // Two segments that clearly cross at (5, 5)
    expect(
      isSelfIntersecting(line([[0, 0], [10, 10], [0, 10], [10, 0]]))
    ).toBe(true);
  });

  it("ignores shared endpoints between adjacent segments", () => {
    expect(
      isSelfIntersecting(line([[0, 0], [5, 5], [10, 0], [15, 5]]))
    ).toBe(false);
  });

  it("returns false for a degenerate 2-point line", () => {
    expect(isSelfIntersecting(line([[0, 0], [1, 1]]))).toBe(false);
  });

  it("accepts a bare LineString geometry (not wrapped in Feature)", () => {
    const geom: LineString = {
      type: "LineString",
      coordinates: [[0, 0], [10, 10], [0, 10], [10, 0]],
    };
    expect(isSelfIntersecting(geom)).toBe(true);
  });
});

describe("isSelfIntersecting — Polygon", () => {
  it("returns false for a simple square", () => {
    expect(
      isSelfIntersecting(
        polygon([
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ])
      )
    ).toBe(false);
  });

  it("returns false for a convex hexagon", () => {
    expect(
      isSelfIntersecting(
        polygon([
          [2, 0],
          [8, 0],
          [10, 5],
          [8, 10],
          [2, 10],
          [0, 5],
        ])
      )
    ).toBe(false);
  });

  it("detects a bowtie polygon (classic self-intersection)", () => {
    expect(
      isSelfIntersecting(
        polygon([
          [0, 0],
          [10, 10],
          [10, 0],
          [0, 10],
        ])
      )
    ).toBe(true);
  });

  it("does not flag the closing segment as a self-intersection", () => {
    // The first and last segments share the start vertex through closure.
    // A simple triangle should be fine.
    expect(
      isSelfIntersecting(polygon([[0, 0], [10, 0], [5, 10]]))
    ).toBe(false);
  });
});

// ── Multi-run pipeline (a2) ────────────────────────────────────────────
describe("MultiLineString geometry", () => {
  const P = {
    a: [-95.9928, 36.154],
    b: [-95.9925, 36.154],
    c: [-95.9925, 36.1543],
    d: [-95.9928, 36.1543],
    e: [-95.9922, 36.1543],
  };
  function mls(runs: number[][][]): Feature<MultiLineString> {
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "MultiLineString", coordinates: runs },
    };
  }

  it("LF of a MultiLineString equals the sum of its runs (parity)", () => {
    const run1 = [P.a, P.b, P.c];
    const run2 = [P.c, P.e]; // branch sharing the junction coord c
    const total = geometryLF(mls([run1, run2]));
    const sum = geometryLF(line(run1)) + geometryLF(line(run2));
    expect(total).toBeCloseTo(sum, 2);
  });

  it("a single-run MultiLineString matches the equivalent LineString (migration parity)", () => {
    const run = [P.a, P.b, P.c, P.d];
    expect(geometryLF(mls([run]))).toBeCloseTo(geometryLF(line(run)), 2);
  });

  it("corner count sums interior vertices, junction anchor not double-counted", () => {
    // run1 has 1 interior corner (b); run2 is a branch off c with no interior.
    expect(cornerCount(mls([[P.a, P.b, P.c], [P.c, P.e]]))).toBe(1);
  });

  it("uniquePostCount dedupes the shared junction coordinate", () => {
    // run1: a,b,c (3) + run2: c,e (2) → 4 distinct (c shared), not 5.
    expect(uniquePostCount(mls([[P.a, P.b, P.c], [P.c, P.e]]))).toBe(4);
  });

  it("does not flag a T-junction (shared endpoint) as self-intersecting", () => {
    expect(isSelfIntersecting(mls([[P.a, P.b, P.c], [P.c, P.e]]))).toBe(false);
  });

  it("flags a run that crosses itself inside a MultiLineString", () => {
    const bowtie = [
      [0, 0],
      [2, 2],
      [2, 0],
      [0, 2],
    ];
    expect(isSelfIntersecting(mls([[P.a, P.b], bowtie]))).toBe(true);
  });
});
