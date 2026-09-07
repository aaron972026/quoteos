import { describe, it, expect } from "vitest";
import type { Position } from "geojson";
import { offsetToCoord, pointToOffset } from "./gate-geo";
import { runLF } from "./draw-state";

// A short roughly-east/west segment near Tulsa, OK. ~ a few tens of feet.
const A: Position = [-95.9928, 36.154];
const B: Position = [-95.9924, 36.154];

describe("offsetToCoord", () => {
  it("returns the start post at offset 0", () => {
    const c = offsetToCoord(A, B, 0);
    expect(c[0]).toBeCloseTo(A[0], 9);
    expect(c[1]).toBeCloseTo(A[1], 9);
  });

  it("returns the end post at the full segment length", () => {
    const c = offsetToCoord(A, B, runLF([A, B]));
    expect(c[0]).toBeCloseTo(B[0], 9);
    expect(c[1]).toBeCloseTo(B[1], 9);
  });

  it("returns the midpoint at half the segment length", () => {
    const c = offsetToCoord(A, B, runLF([A, B]) / 2);
    expect(c[0]).toBeCloseTo((A[0] + B[0]) / 2, 9);
    expect(c[1]).toBeCloseTo((A[1] + B[1]) / 2, 9);
  });

  it("clamps an offset past the end to the end post", () => {
    const c = offsetToCoord(A, B, runLF([A, B]) * 5);
    expect(c[0]).toBeCloseTo(B[0], 9);
  });
});

describe("pointToOffset", () => {
  it("is ~0 at the start post", () => {
    expect(pointToOffset(A, B, A)).toBeCloseTo(0, 5);
  });

  it("is ~segment length at the end post", () => {
    expect(pointToOffset(A, B, B)).toBeCloseTo(runLF([A, B]), 1);
  });

  it("round-trips with offsetToCoord within a foot", () => {
    const segLen = runLF([A, B]);
    const off = segLen * 0.37;
    const back = pointToOffset(A, B, offsetToCoord(A, B, off));
    expect(back).toBeCloseTo(off, 1);
  });
});
