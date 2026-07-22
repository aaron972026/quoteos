import { describe, expect, it } from "vitest";
import {
  APPOINTMENT_TIMEZONE,
  SLOT_START_TIMES,
  generateSlots,
  groupSlotsByDay,
  isSlotBookable,
  zonedWallClockToUtc,
} from "./availability";

/**
 * Anchors verified against ICU before writing these:
 *   2026-03-03 Tue — CST (UTC-6) → 9:00 local = 15:00Z
 *   2026-03-10 Tue — CDT (UTC-5) → 9:00 local = 14:00Z
 *   2026-08-03 Mon, 08-04 Tue, 08-05 Wed, 08-07 Fri (all CDT)
 * US DST 2026 begins Sun 2026-03-08.
 */
const MONDAY_AUG_3 = new Date("2026-08-03T12:00:00Z");

/** Local weekday abbreviation for an instant, in Tulsa time. */
function localWeekday(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APPOINTMENT_TIMEZONE,
    weekday: "short",
  }).format(d);
}

describe("generateSlots — day rules", () => {
  it("only offers Tuesday, Wednesday, and Friday", () => {
    const slots = generateSlots({ now: MONDAY_AUG_3 });
    expect(slots.length).toBeGreaterThan(0);
    const days = new Set(slots.map((s) => localWeekday(s.startsAt)));
    expect(Array.from(days).sort()).toEqual(["Fri", "Tue", "Wed"]);
  });

  it("offers one slot per configured start time on a bookable day", () => {
    const slots = generateSlots({ now: MONDAY_AUG_3 });
    const tueAug4 = slots.filter((s) => s.dayLabel === "Tue, Aug 4");
    expect(tueAug4).toHaveLength(SLOT_START_TIMES.length);
  });

  it("returns slots in ascending chronological order", () => {
    const slots = generateSlots({ now: MONDAY_AUG_3 });
    const times = slots.map((s) => s.startsAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

describe("generateSlots — lead time and horizon", () => {
  it("excludes slots inside the minimum lead time", () => {
    // 48h lead from Mon noon pushes past every Tue Aug 4 window.
    const slots = generateSlots({ now: MONDAY_AUG_3, minLeadHours: 48 });
    expect(slots.some((s) => s.dayLabel === "Tue, Aug 4")).toBe(false);
    expect(slots.some((s) => s.dayLabel === "Wed, Aug 5")).toBe(true);
  });

  it("honors the default 24h lead — the next day is bookable", () => {
    const slots = generateSlots({ now: MONDAY_AUG_3 });
    expect(slots.some((s) => s.dayLabel === "Tue, Aug 4")).toBe(true);
  });

  it("never returns a slot beyond the booking horizon", () => {
    const horizonDays = 21;
    const slots = generateSlots({ now: MONDAY_AUG_3, horizonDays });
    const limit = MONDAY_AUG_3.getTime() + horizonDays * 86_400_000;
    for (const s of slots) expect(s.startsAt.getTime()).toBeLessThanOrEqual(limit);
  });

  it("a shorter horizon returns strictly fewer slots", () => {
    const wide = generateSlots({ now: MONDAY_AUG_3, horizonDays: 21 });
    const narrow = generateSlots({ now: MONDAY_AUG_3, horizonDays: 7 });
    expect(narrow.length).toBeLessThan(wide.length);
  });
});

describe("generateSlots — booked exclusion", () => {
  it("removes an already-booked slot", () => {
    const all = generateSlots({ now: MONDAY_AUG_3 });
    const target = all[0];
    const rest = generateSlots({ now: MONDAY_AUG_3, booked: [target.startsAt] });
    expect(rest).toHaveLength(all.length - 1);
    expect(rest.some((s) => s.key === target.key)).toBe(false);
  });

  it("accepts ISO strings as booked input (what the DB hands back)", () => {
    const all = generateSlots({ now: MONDAY_AUG_3 });
    const target = all[0];
    const rest = generateSlots({
      now: MONDAY_AUG_3,
      booked: [target.startsAt.toISOString()],
    });
    expect(rest.some((s) => s.key === target.key)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// The one that actually matters: 9:00 AM Tulsa is a DIFFERENT UTC
// instant either side of the DST boundary. Getting this wrong books
// customers an hour off for half the year.
// ════════════════════════════════════════════════════════════════════
describe("daylight saving correctness", () => {
  it("resolves 9:00 Central to 15:00Z during CST (before DST)", () => {
    expect(
      zonedWallClockToUtc(2026, 3, 3, 9, 0).toISOString()
    ).toBe("2026-03-03T15:00:00.000Z");
  });

  it("resolves 9:00 Central to 14:00Z during CDT (after DST)", () => {
    expect(
      zonedWallClockToUtc(2026, 3, 10, 9, 0).toISOString()
    ).toBe("2026-03-10T14:00:00.000Z");
  });

  it("generated slots straddling the DST change keep the same local time", () => {
    const slots = generateSlots({ now: new Date("2026-03-01T00:00:00Z") });
    const beforeDst = slots.find((s) => s.dayLabel === "Tue, Mar 3");
    const afterDst = slots.find((s) => s.dayLabel === "Tue, Mar 10");
    expect(beforeDst?.startsAt.toISOString()).toBe("2026-03-03T15:00:00.000Z");
    expect(afterDst?.startsAt.toISOString()).toBe("2026-03-10T14:00:00.000Z");
    // Same wall-clock label on both sides of the boundary.
    expect(beforeDst?.timeLabel).toBe(afterDst?.timeLabel);
  });

  it("labels render in Tulsa time, not UTC", () => {
    const slots = generateSlots({ now: MONDAY_AUG_3 });
    const first = slots.find((s) => s.dayLabel === "Tue, Aug 4");
    // 14:00Z — would read as "2:00" if we formatted in UTC.
    expect(first?.startsAt.toISOString()).toBe("2026-08-04T14:00:00.000Z");
    expect(first?.timeLabel).toBe("9:00 – 10:30 AM");
  });
});

describe("isSlotBookable — server-side validation", () => {
  it("accepts a slot that is currently on offer", () => {
    const slot = generateSlots({ now: MONDAY_AUG_3 })[0];
    expect(isSlotBookable(slot.startsAt, { now: MONDAY_AUG_3 })).toBe(true);
  });

  it("rejects an off-grid time the client invented", () => {
    // 9:07 AM Central — not a configured start.
    const bogus = zonedWallClockToUtc(2026, 8, 4, 9, 7);
    expect(isSlotBookable(bogus, { now: MONDAY_AUG_3 })).toBe(false);
  });

  it("rejects a non-bookable weekday (Monday)", () => {
    const monday = zonedWallClockToUtc(2026, 8, 10, 9, 0);
    expect(isSlotBookable(monday, { now: MONDAY_AUG_3 })).toBe(false);
  });

  it("rejects a slot that is already booked", () => {
    const slot = generateSlots({ now: MONDAY_AUG_3 })[0];
    expect(
      isSlotBookable(slot.startsAt, { now: MONDAY_AUG_3, booked: [slot.startsAt] })
    ).toBe(false);
  });

  it("rejects a slot inside the lead time", () => {
    const slot = generateSlots({ now: MONDAY_AUG_3 })[0];
    expect(
      isSlotBookable(slot.startsAt, { now: MONDAY_AUG_3, minLeadHours: 240 })
    ).toBe(false);
  });

  it("rejects garbage input without throwing", () => {
    expect(isSlotBookable("not-a-date", { now: MONDAY_AUG_3 })).toBe(false);
  });
});

describe("groupSlotsByDay", () => {
  it("groups consecutive slots under their day label", () => {
    const slots = generateSlots({ now: MONDAY_AUG_3 });
    const groups = groupSlotsByDay(slots);
    expect(groups[0].dayLabel).toBe("Tue, Aug 4");
    expect(groups[0].slots).toHaveLength(SLOT_START_TIMES.length);
    // Day labels are unique across groups.
    const labels = groups.map((g) => g.dayLabel);
    expect(new Set(labels).size).toBe(labels.length);
    // Every slot survives grouping.
    expect(groups.reduce((n, g) => n + g.slots.length, 0)).toBe(slots.length);
  });
});
