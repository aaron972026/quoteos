import { describe, expect, it } from "vitest";
import { countDeferredGates } from "./gates";

describe("countDeferredGates", () => {
  it("counts sliding gates as deferred", () => {
    expect(countDeferredGates([{ type: "sliding", width_ft: 10 }])).toBe(1);
    expect(countDeferredGates([{ type: "sliding", width_ft: 4 }])).toBe(1); // any width
  });

  it("counts per-leaf width over 6' as deferred (single + double)", () => {
    expect(countDeferredGates([{ type: "single", width_ft: 8 }])).toBe(1);
    expect(countDeferredGates([{ type: "double", width_ft: 7 }])).toBe(1);
  });

  it("does not defer priced widths (<= 6')", () => {
    expect(countDeferredGates([{ type: "single", width_ft: 6 }])).toBe(0);
    expect(countDeferredGates([{ type: "double", width_ft: 5 }])).toBe(0);
  });

  it("never defers legacy gates", () => {
    expect(countDeferredGates([{ type: "D16", width_ft: undefined }])).toBe(0);
    expect(countDeferredGates([{ type: "W3" }])).toBe(0);
  });

  it("sums a mixed array and handles empty/null", () => {
    expect(
      countDeferredGates([
        { type: "single", width_ft: 5 }, // priced
        { type: "sliding", width_ft: 10 }, // deferred
        { type: "double", width_ft: 9 }, // deferred (wide)
        { type: "D10", count: 1 }, // legacy, not deferred
      ])
    ).toBe(2);
    expect(countDeferredGates([])).toBe(0);
    expect(countDeferredGates(null)).toBe(0);
  });
});
