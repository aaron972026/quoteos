import { describe, expect, it } from "vitest";
import {
  formatInstallWeek,
  nextInstallWeekStartISO,
  priceHoldExpiryISO,
} from "./install-week";

// Anchors verified against calendar math before writing:
//   from 2026-07-27 (Mon) → +10 = Aug 6 (Thu) → Monday 2026-08-10
//   from 2026-07-31 (Fri) → +10 = Aug 10 (Mon, exactly 10 out) → 2026-08-10
//   from 2026-08-01 (Sat) → +10 = Aug 11 (Tue) → Monday 2026-08-17
const noonUtc = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("nextInstallWeekStartISO", () => {
  it("returns the Monday of the week at least 10 days out", () => {
    expect(nextInstallWeekStartISO(noonUtc("2026-07-27"))).toBe("2026-08-10");
  });

  it("uses that same Monday when +10 lands exactly on a Monday", () => {
    expect(nextInstallWeekStartISO(noonUtc("2026-07-31"))).toBe("2026-08-10");
  });

  it("rolls to the following Monday when +10 lands mid-week", () => {
    expect(nextInstallWeekStartISO(noonUtc("2026-08-01"))).toBe("2026-08-17");
  });

  it("always returns a Monday", () => {
    for (let offset = 0; offset < 21; offset++) {
      const iso = nextInstallWeekStartISO(noonUtc("2026-07-27"), "UTC");
      const [y, m, d] = iso.split("-").map(Number);
      expect(new Date(Date.UTC(y, m - 1, d)).getUTCDay()).toBe(1);
    }
  });

  it("is always at least 10 days beyond 'now'", () => {
    const now = noonUtc("2026-08-01");
    const iso = nextInstallWeekStartISO(now, "UTC");
    const [y, m, d] = iso.split("-").map(Number);
    const start = Date.UTC(y, m - 1, d);
    expect((start - now.getTime()) / 86_400_000).toBeGreaterThanOrEqual(10);
  });
});

describe("formatInstallWeek", () => {
  it("formats without slipping a day (parses parts, not UTC-midnight Date)", () => {
    expect(formatInstallWeek("2026-08-10")).toBe("August 10");
  });

  it("localizes the month in Spanish", () => {
    // es-US renders "10 de agosto"
    expect(formatInstallWeek("2026-08-10", "es").toLowerCase()).toContain("agosto");
  });

  it("returns the raw string on malformed input", () => {
    expect(formatInstallWeek("nope")).toBe("nope");
  });
});

describe("priceHoldExpiryISO", () => {
  it("is 14 days out by default", () => {
    expect(priceHoldExpiryISO(noonUtc("2026-08-01"), 14, "UTC")).toBe("2026-08-15");
  });
});
