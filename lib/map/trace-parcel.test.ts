import { describe, expect, it } from "vitest";
import { traceFenceFromParcel } from "./trace-parcel";
import { geometryLF } from "./linear-feet";

/**
 * Synthetic block in Tulsa (lat ~36.15). Degrees per meter at this
 * latitude: lat ≈ 1/111320, lng ≈ 1/(111320·cos(36.15°)) ≈ 1/89875.
 */
const LAT0 = 36.15;
const LNG0 = -95.95;
const DLAT = 1 / 111_320; // degrees latitude per meter
const DLNG = 1 / (111_320 * Math.cos((LAT0 * Math.PI) / 180));

/** Axis-aligned rectangular parcel: x/y offsets in meters from origin. */
function rect(x: number, y: number, w: number, h: number) {
  const ring = [
    [LNG0 + x * DLNG, LAT0 + y * DLAT],
    [LNG0 + (x + w) * DLNG, LAT0 + y * DLAT],
    [LNG0 + (x + w) * DLNG, LAT0 + (y + h) * DLAT],
    [LNG0 + x * DLNG, LAT0 + (y + h) * DLAT],
    [LNG0 + x * DLNG, LAT0 + y * DLAT],
  ];
  return { type: "Polygon" as const, coordinates: [ring] };
}

// Subject lot: 20m wide × 40m deep, street on the SOUTH (y=0) edge.
const SUBJECT = rect(0, 0, 20, 40);
// Neighbors: left, right, and rear — leaving the south edge unshared.
const LEFT = rect(-20, 0, 20, 40);
const RIGHT = rect(20, 0, 20, 40);
const REAR = rect(0, 40, 20, 40);

describe("traceFenceFromParcel", () => {
  it("removes the street frontage when neighbors flank the other sides", () => {
    const out = traceFenceFromParcel(SUBJECT, [LEFT, RIGHT, REAR]);
    expect(out).not.toBeNull();
    expect(out!.frontageRemoved).toBe(true);
    expect(out!.feature.geometry.type).toBe("LineString");
    // Open chain should cover side + rear + side = 40 + 20 + 40 = 100m
    // ≈ 328 LF (within simplification slack).
    const lf = geometryLF(out!.feature);
    expect(lf).toBeGreaterThan(310);
    expect(lf).toBeLessThan(345);
    // Chain endpoints should both sit on the street edge (y = 0).
    const coords = (out!.feature.geometry as GeoJSON.LineString).coordinates;
    const yMeters = (lat: number) => (lat - LAT0) / DLAT;
    expect(Math.abs(yMeters(coords[0][1]))).toBeLessThan(1);
    expect(Math.abs(yMeters(coords[coords.length - 1][1]))).toBeLessThan(1);
  });

  it("falls back to the full perimeter polygon when no neighbors exist", () => {
    const out = traceFenceFromParcel(SUBJECT, []);
    expect(out).not.toBeNull();
    expect(out!.frontageRemoved).toBe(false);
    expect(out!.feature.geometry.type).toBe("Polygon");
    // Perimeter = 2·(20+40) = 120m ≈ 394 LF
    const lf = geometryLF(out!.feature);
    expect(lf).toBeGreaterThan(380);
    expect(lf).toBeLessThan(410);
  });

  it("falls back to polygon on a corner lot where frontage dominates", () => {
    // Only the rear neighbor — left/right/front all unshared = a single
    // unshared run of 3 edges ≈ 83% of perimeter → unreliable → polygon.
    const out = traceFenceFromParcel(SUBJECT, [REAR]);
    expect(out).not.toBeNull();
    expect(out!.frontageRemoved).toBe(false);
    expect(out!.feature.geometry.type).toBe("Polygon");
  });

  it("simplifies survey noise: dense collinear vertices collapse", () => {
    // Same 20×40 rectangle but the south edge carries 50 collinear points.
    const ring: number[][] = [];
    for (let i = 0; i <= 50; i++) {
      ring.push([LNG0 + ((20 * i) / 50) * DLNG, LAT0]);
    }
    ring.push([LNG0 + 20 * DLNG, LAT0 + 40 * DLAT]);
    ring.push([LNG0, LAT0 + 40 * DLAT]);
    ring.push([LNG0, LAT0]);
    const noisy = { type: "Polygon" as const, coordinates: [ring] };
    const out = traceFenceFromParcel(noisy, []);
    expect(out).not.toBeNull();
    expect(out!.vertexCount).toBeLessThanOrEqual(8);
    const lf = geometryLF(out!.feature);
    expect(lf).toBeGreaterThan(380);
    expect(lf).toBeLessThan(410);
  });

  it("uses the largest polygon of a MultiPolygon", () => {
    const sliver = rect(100, 100, 2, 2);
    const multi = {
      type: "MultiPolygon" as const,
      coordinates: [sliver.coordinates, SUBJECT.coordinates],
    };
    const out = traceFenceFromParcel(multi, []);
    expect(out).not.toBeNull();
    const lf = geometryLF(out!.feature);
    expect(lf).toBeGreaterThan(380); // the 20×40, not the 2×2 sliver
  });

  it("returns null on degenerate input", () => {
    const degenerate = {
      type: "Polygon" as const,
      coordinates: [[[LNG0, LAT0], [LNG0, LAT0]]],
    };
    expect(traceFenceFromParcel(degenerate, [])).toBeNull();
  });
});
