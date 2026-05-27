import { describe, expect, it } from "vitest";
import { assignVariant } from "./assign";
import type { Experiment } from "./registry";

function exp(weights: number[]): Experiment {
  return {
    key: "test_exp",
    name: "Test",
    variants: weights.map((w, i) => ({
      key: `v${i}`,
      label: `V${i}`,
      weight: w,
    })) as Experiment["variants"],
    active: true,
  };
}

describe("assignVariant", () => {
  it("returns the same variant for the same (session, experiment)", () => {
    const e = exp([1, 1]);
    const a = assignVariant(e, "session-abc");
    const b = assignVariant(e, "session-abc");
    expect(a).toBe(b);
  });

  it("different sessions can land in different buckets", () => {
    const e = exp([1, 1]);
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) results.add(assignVariant(e, `s-${i}`));
    expect(results.size).toBeGreaterThan(1);
  });

  it("respects weight distribution over many sessions (50/50 within ±10%)", () => {
    const e = exp([1, 1]);
    let v0 = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      if (assignVariant(e, `seed-${i}`) === "v0") v0++;
    }
    const pct = v0 / N;
    expect(pct).toBeGreaterThan(0.4);
    expect(pct).toBeLessThan(0.6);
  });

  it("90/10 distribution lands within ±3%", () => {
    const e = exp([9, 1]);
    let v1 = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      if (assignVariant(e, `seed-${i}`) === "v1") v1++;
    }
    const pct = v1 / N;
    expect(pct).toBeGreaterThan(0.07);
    expect(pct).toBeLessThan(0.13);
  });

  it("falls back to first variant when all weights are zero", () => {
    const e = exp([0, 0]);
    expect(assignVariant(e, "any")).toBe("v0");
  });

  it("treats negative weights as zero (defensive)", () => {
    const e = exp([-5, 1]);
    // Only v1 has positive weight; every session should land there
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) results.add(assignVariant(e, `s-${i}`));
    expect(Array.from(results)).toEqual(["v1"]);
  });

  it("changing experiment key reshuffles assignments", () => {
    const e1: Experiment = { ...exp([1, 1]), key: "exp_a" };
    const e2: Experiment = { ...exp([1, 1]), key: "exp_b" };
    let mismatches = 0;
    for (let i = 0; i < 100; i++) {
      const s = `s-${i}`;
      if (assignVariant(e1, s) !== assignVariant(e2, s)) mismatches++;
    }
    // ~50% should differ
    expect(mismatches).toBeGreaterThan(30);
    expect(mismatches).toBeLessThan(70);
  });
});
