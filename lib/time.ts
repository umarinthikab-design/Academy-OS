// Time-zone-aware helpers for session start / deadline / "today" computations.
// All functions read the academy's timeZone from AcademySettings so that
// wall-clock dates/times are interpreted correctly regardless of the server's
// UTC runtime (e.g. Vercel).  The core invariant is: ScheduledSession.date is
// stored as a UTC calendar date at 00:00.  When we need a wall-clock instant
// (e.g. "6 hours before start", "started?", "today"), we consult the
// academy's timeZone.

// ----- Core: instant from a calendar date + wall-clock start time -----
// ScheduledSession.date is a UTC calendar date at 00:00. Given that date and a
// wall-clock startTime such as "17:00", return the real instant at which that
// wall-clock time happens in the given IANA time zone. DST-aware: the zone's
// offset is looked up at the target moment, not assumed.
function zoneOffsetMinutes(timeZone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)!.value, 10);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

export function sessionStartInstant(date: Date, startTime: string, timeZone: string): Date {
  const [h, m] = startTime.split(":").map(Number);
  const wall = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h || 0, m || 0, 0, 0);
  // Two passes so a date near a DST change still lands on the right offset.
  let instant = wall - zoneOffsetMinutes(timeZone, new Date(wall)) * 60000;
  instant = wall - zoneOffsetMinutes(timeZone, new Date(instant)) * 60000;
  return new Date(instant);
}

// ----- Convenience helpers -----

// Return a Date representing the start of today (00:00:00.000) in the given
// time zone.  If `now` is not provided, uses `new Date()`.
export function startOfTodayInZone(timeZone: string, now?: Date): Date {
  const date = now || new Date();
  // Use the same Intl pattern to get the start of day in the zone
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1;
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

// Render a date-only string for a session date, using timeZone: "UTC" because
// session dates are stored as UTC calendar dates.  This ensures the displayed
// date matches the calendar date stored in the DB regardless of the user's
// local time zone.
export function formatSessionDate(
  date: Date,
  options: { timeZone?: string } = { timeZone: "UTC" }
): string {
  return date.toLocaleDateString(undefined, {
    ...options,
    timeZone: options.timeZone || "UTC",
  });
}
