import { describe, expect, it } from "vitest";
import { isSelfIntersecting } from "./linear-feet";
import type { Feature, LineString, Polygon } from "geojson";

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
