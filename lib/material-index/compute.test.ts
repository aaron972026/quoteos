import { describe, expect, it } from "vitest";
import {
  affectedFamilies,
  buildSignal,
  formatChange,
  momChange,
} from "./compute";
import type { TrackedIndex } from "./registry";
import type { FredObservation } from "@/lib/integrations/fred";

const LUMBER: TrackedIndex = {
  seriesId: "WPU081101",
  label: "Softwood lumber PPI",
  families: ["CPF", "HCF", "RR", "BP"],
  thresholdPct: 3,
};

const STEEL: TrackedIndex = {
  seriesId: "WPU101",
  label: "Iron & steel PPI",
  families: ["CL"],
  thresholdPct: 3,
};

function obs(date: string, value: number | null): FredObservation {
  return { date, value };
}

describe("momChange", () => {
  it("computes MoM percent change from newest-first observations", () => {
    const r = momChange([obs("2026-05-01", 110), obs("2026-04-01", 100)]);
    expect(r).not.toBeNull();
    expect(r!.changePct).toBeCloseTo(0.1, 5);
    expect(r!.latest.date).toBe("2026-05-01");
    expect(r!.prior.date).toBe("2026-04-01");
  });

  it("skips null values and picks the two most recent valid observations", () => {
    const r = momChange([
      obs("2026-05-01", null),
      obs("2026-04-01", 105),
      obs("2026-03-01", 100),
    ]);
    expect(r).not.toBeNull();
    expect(r!.latest.value).toBe(105);
    expect(r!.prior.value).toBe(100);
  });

  it("returns null when fewer than 2 valid observations", () => {
    expect(momChange([])).toBeNull();
    expect(momChange([obs("2026-05-01", 100)])).toBeNull();
    expect(
      momChange([obs("2026-05-01", null), obs("2026-04-01", null)])
    ).toBeNull();
  });

  it("returns null on divide-by-zero", () => {
    expect(momChange([obs("2026-05-01", 5), obs("2026-04-01", 0)])).toBeNull();
  });

  it("handles negative changes (deflation)", () => {
    const r = momChange([obs("2026-05-01", 90), obs("2026-04-01", 100)]);
    expect(r!.changePct).toBeCloseTo(-0.1, 5);
  });
});

describe("buildSignal", () => {
  it("flags when |change| meets threshold", () => {
    const sig = buildSignal(LUMBER, [
      obs("2026-05-01", 105),
      obs("2026-04-01", 100),
    ]);
    expect(sig?.flagged).toBe(true); // +5% >= 3%
    expect(sig?.changePct).toBeCloseTo(0.05, 5);
  });

  it("does not flag when change is under threshold", () => {
    const sig = buildSignal(LUMBER, [
      obs("2026-05-01", 102),
      obs("2026-04-01", 100),
    ]);
    expect(sig?.flagged).toBe(false); // +2% < 3%
  });

  it("flags negative swings too (cost going down — drop prices)", () => {
    const sig = buildSignal(LUMBER, [
      obs("2026-05-01", 95),
      obs("2026-04-01", 100),
    ]);
    expect(sig?.flagged).toBe(true);
    expect(sig?.changePct).toBeCloseTo(-0.05, 5);
  });

  it("returns null when there's not enough data", () => {
    expect(buildSignal(LUMBER, [])).toBeNull();
    expect(buildSignal(LUMBER, [obs("2026-05-01", 100)])).toBeNull();
  });
});

describe("formatChange", () => {
  it.each([
    [0.045, "+4.5%"],
    [-0.021, "-2.1%"],
    [0, "0.0%"],
    [0.1234, "+12.3%"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatChange(input)).toBe(expected);
  });
});

describe("affectedFamilies", () => {
  it("dedupes families across multiple flagged signals", () => {
    const sig1 = buildSignal(LUMBER, [
      obs("2026-05-01", 105),
      obs("2026-04-01", 100),
    ])!;
    const sig2 = buildSignal(STEEL, [
      obs("2026-05-01", 110),
      obs("2026-04-01", 100),
    ])!;
    const families = affectedFamilies([sig1, sig2]);
    // Lumber: CPF, HCF, RR, BP — Steel: CL — union = 5 unique
    expect(new Set(families).size).toBe(5);
  });

  it("returns empty when no signals flagged", () => {
    const sig = buildSignal(LUMBER, [
      obs("2026-05-01", 101),
      obs("2026-04-01", 100),
    ])!;
    expect(affectedFamilies([sig])).toEqual([]);
  });
});
