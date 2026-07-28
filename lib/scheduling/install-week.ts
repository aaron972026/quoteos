/**
 * Install-week anchor for the "Reserve my install week" lane.
 *
 * Rule: the week of the next Monday that is at least MIN_LEAD_DAYS out (the
 * install promise). Computed ONCE at reservation time and PERSISTED on the
 * quote (`reserved_week_start`) — never recomputed, so a customer who was
 * told "week of August 10" always sees August 10.
 *
 * A calendar date has no time zone; we anchor "today" to Tulsa so the
 * rollover happens on the customer's clock, not the server's UTC clock.
 */

export const INSTALL_TIMEZONE = "America/Chicago";
export const MIN_LEAD_DAYS = 10;

/** Today's calendar date as seen in `tz`. */
function todayYmd(now: Date, tz: string): { y: number; m: number; d: number } {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
}

function addDays(y: number, m: number, d: number, delta: number) {
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** Weekday (0=Sun … 6=Sat) of a calendar date. */
function weekdayOf(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * ISO `YYYY-MM-DD` of the reserved install week's Monday.
 * Stored verbatim in the `reserved_week_start` date column.
 */
export function nextInstallWeekStartISO(
  now: Date = new Date(),
  tz: string = INSTALL_TIMEZONE
): string {
  const today = todayYmd(now, tz);
  const earliest = addDays(today.y, today.m, today.d, MIN_LEAD_DAYS);
  const wd = weekdayOf(earliest.y, earliest.m, earliest.d);
  // Days forward to Monday (weekday 1). 0 when earliest is already Monday.
  const toMonday = (1 - wd + 7) % 7;
  const mon = addDays(earliest.y, earliest.m, earliest.d, toMonday);
  return `${mon.y}-${pad(mon.m)}-${pad(mon.d)}`;
}

/**
 * Human label for a stored `reserved_week_start`, e.g. "August 10".
 * Parses the date parts directly (no `new Date("YYYY-MM-DD")`, which would
 * be interpreted as UTC midnight and can slip a day in western zones).
 */
export function formatInstallWeek(
  isoDate: string,
  locale: string = "en-US"
): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** ISO date N days from now, for the free price-hold expiry. */
export function priceHoldExpiryISO(
  now: Date = new Date(),
  days = 14,
  tz: string = INSTALL_TIMEZONE
): string {
  const today = todayYmd(now, tz);
  const exp = addDays(today.y, today.m, today.d, days);
  return `${exp.y}-${pad(exp.m)}-${pad(exp.d)}`;
}
