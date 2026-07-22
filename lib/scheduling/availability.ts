/**
 * Scope-confirmation visit scheduling — availability engine.
 *
 * Pure logic: given "now" and the already-booked slots, produce the list of
 * bookable arrival windows. No DB, no I/O, so it is fully unit-testable.
 *
 * TIMEZONE CONTRACT (the part that breaks if you're careless):
 *   - Slots are DEFINED in Tulsa wall-clock time (America/Chicago).
 *   - Slots are STORED and COMPARED as UTC instants.
 * The server runs in UTC on Vercel, so we must never use local-time Date
 * arithmetic to build a slot — 9:00 AM Central is 15:00Z in winter and
 * 14:00Z in summer. Everything below goes through `zonedWallClockToUtc`,
 * which resolves the real offset (incl. DST) via Intl.
 */

export const APPOINTMENT_TIMEZONE = "America/Chicago";

/** Bookable weekdays, JS `getDay()` convention (0 = Sunday). Tue/Wed/Fri. */
export const APPOINTMENT_WEEKDAYS: readonly number[] = [2, 3, 5];

/**
 * Slot start times in LOCAL Tulsa time, 24h "HH:MM".
 * 90-minute arrival windows across a 9:00–4:30 day.
 * Edit this array to change the day's shape (e.g. drop "12:00" for a
 * lunch gap) — nothing else needs to change.
 */
export const SLOT_START_TIMES: readonly string[] = [
  "09:00",
  "10:30",
  "12:00",
  "13:30",
  "15:00",
];

/** Length of each arrival window, minutes. */
export const SLOT_MINUTES = 90;

/** Earliest a customer may book, hours from now. Backs the "24h" promise. */
export const MIN_LEAD_HOURS = 24;

/** How far ahead the calendar opens. */
export const BOOKING_HORIZON_DAYS = 21;

export interface Slot {
  /** UTC instant the window opens. */
  startsAt: Date;
  /** UTC instant the window closes. */
  endsAt: Date;
  /** Stable identifier the client sends back when booking (ISO of startsAt). */
  key: string;
  /** "Tue, Aug 4" */
  dayLabel: string;
  /** "9:00 – 10:30 AM" */
  timeLabel: string;
}

// ─── Timezone primitives (native Intl — no dependency) ──────────────────

/** Offset of `tz` from UTC, in ms, at a given instant. */
function zoneOffsetMs(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  // Some ICU builds emit "24" for midnight under hour12:false.
  const hour = p.hour === "24" ? 0 : Number(p.hour);
  const asIfUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    hour,
    Number(p.minute),
    Number(p.second)
  );
  return asIfUtc - instant.getTime();
}

/**
 * Convert a wall-clock time in `tz` to the corresponding UTC instant.
 * Two-pass: guess with the offset at the naive instant, then re-resolve at
 * the corrected instant so DST transition days land correctly.
 */
export function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string = APPOINTMENT_TIMEZONE
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstOffset = zoneOffsetMs(new Date(naive), tz);
  let ts = naive - firstOffset;
  const secondOffset = zoneOffsetMs(new Date(ts), tz);
  if (secondOffset !== firstOffset) ts = naive - secondOffset;
  return new Date(ts);
}

/** The calendar date (as seen in `tz`) for a given instant. */
function zonedYmd(
  instant: Date,
  tz: string
): { year: number; month: number; day: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day) };
}

/** Weekday (0=Sun) of a calendar date, timezone-independent. */
function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Add whole days to a calendar date. */
function addDays(
  year: number,
  month: number,
  day: number,
  delta: number
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

// ─── Labels ─────────────────────────────────────────────────────────────

function formatDayLabel(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(instant);
}

function formatTimeLabel(start: Date, end: Date, tz: string): string {
  const time = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  const startStr = time(start).replace(/\s?[AP]M$/, "");
  return `${startStr} – ${time(end)}`;
}

// ─── Slot generation ────────────────────────────────────────────────────

export interface GenerateOptions {
  /** Defaults to the real clock; inject a fixed value in tests. */
  now?: Date;
  /** Already-taken slot starts. Accepts Dates or ISO strings. */
  booked?: ReadonlyArray<Date | string>;
  timezone?: string;
  minLeadHours?: number;
  horizonDays?: number;
}

/**
 * Every bookable arrival window, ascending. A slot is offered when it falls
 * on a bookable weekday, is at least `minLeadHours` out, is inside the
 * horizon, and is not already booked.
 */
export function generateSlots(options: GenerateOptions = {}): Slot[] {
  const {
    now = new Date(),
    booked = [],
    timezone = APPOINTMENT_TIMEZONE,
    minLeadHours = MIN_LEAD_HOURS,
    horizonDays = BOOKING_HORIZON_DAYS,
  } = options;

  const earliest = now.getTime() + minLeadHours * 3600_000;
  const latest = now.getTime() + horizonDays * 86_400_000;
  const takenKeys = new Set(
    booked.map((b) => (b instanceof Date ? b : new Date(b)).getTime())
  );

  const today = zonedYmd(now, timezone);
  const slots: Slot[] = [];

  // +1 so a slot late on the horizon's final local day is still considered.
  for (let offset = 0; offset <= horizonDays + 1; offset++) {
    const { year, month, day } = addDays(
      today.year,
      today.month,
      today.day,
      offset
    );
    if (!APPOINTMENT_WEEKDAYS.includes(weekdayOf(year, month, day))) continue;

    for (const hhmm of SLOT_START_TIMES) {
      const [hh, mm] = hhmm.split(":").map(Number);
      const startsAt = zonedWallClockToUtc(year, month, day, hh, mm, timezone);
      const ms = startsAt.getTime();
      if (ms < earliest || ms > latest) continue;
      if (takenKeys.has(ms)) continue;

      const endsAt = new Date(ms + SLOT_MINUTES * 60_000);
      slots.push({
        startsAt,
        endsAt,
        key: startsAt.toISOString(),
        dayLabel: formatDayLabel(startsAt, timezone),
        timeLabel: formatTimeLabel(startsAt, endsAt, timezone),
      });
    }
  }

  slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return slots;
}

/**
 * Server-side validation for an incoming booking. NEVER trust a client to
 * send a legitimate slot — re-derive and confirm the requested instant is
 * actually on offer right now.
 */
export function isSlotBookable(
  startsAt: Date | string,
  options: GenerateOptions = {}
): boolean {
  const target = (startsAt instanceof Date ? startsAt : new Date(startsAt)).getTime();
  if (!Number.isFinite(target)) return false;
  return generateSlots(options).some((s) => s.startsAt.getTime() === target);
}

/** Group slots by local day, preserving order — convenience for the UI. */
export function groupSlotsByDay(slots: Slot[]): Array<{ dayLabel: string; slots: Slot[] }> {
  const out: Array<{ dayLabel: string; slots: Slot[] }> = [];
  for (const slot of slots) {
    const last = out[out.length - 1];
    if (last && last.dayLabel === slot.dayLabel) last.slots.push(slot);
    else out.push({ dayLabel: slot.dayLabel, slots: [slot] });
  }
  return out;
}
