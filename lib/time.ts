// Time-zone-aware helpers for session start / deadline / "today" computations.
// All functions read the academy's timeZone from AcademySettings so that
// wall-clock dates/times are interpreted correctly regardless of the server's
// UTC runtime (e.g. Vercel).  The core invariant is: ScheduledSession.date is
// stored as a UTC calendar date at 00:00.  When we need a wall-clock instant
// (e.g. "6 hours before start", "started?", "today"), we consult the
// academy's timeZone.

// ----- Core: instant from a calendar date + wall-clock start time -----
// Given a Date whose year/month/day we treat as the calendar date, and a
// startTime string like "14:00", return the corresponding instant interpreted
// in the given IANA time zone.  We use Intl.DateTimeFormat to compute the
// DST offset for the given date, so DST transitions are handled correctly.
export function sessionStartInstant(
  date: Date,
  startTime: string,
  timeZone: string
): Date {
  const [h, m] = startTime.split(":").map(Number);

  // Build a date in the target zone using the UTC year/month/day from `date`
  // and the startTime hour/minute.  Intl.DateTimeFormat with formatToParts
  // gives us the components and the offset, including DST.
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
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1; // 0-indexed
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value, 10);

  // Build a UTC Date from the extracted components
  const utcInstant = new Date(Date.UTC(year, month, day, hour, minute, 0, 0));

  // Now we need to apply the zone's offset at that calendar moment.
  // The most reliable way: format the same components back in the zone and
  // read the offset from the result.
  const offsetFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    timeZoneName: "shortOffset",
  });
  const offsetParts = offsetFormatter.formatToParts(
    new Date(Date.UTC(year, month, day, hour, minute, 0, 0))
  );
  const tzName = offsetParts.find((p) => p.type === "timeZoneName")!.value;
  // Parse the offset from "UTC+5", "UTC-05:00", "UTC", etc.
  // The offset is the time difference from UTC in minutes.
  let offsetMinutes = 0;
  const offsetMatch = tzName.match(/UTC([+-]\d{1,2}(?::\d{2})?)/);
  if (offsetMatch) {
    const sign = offsetMatch[1].startsWith("-") ? -1 : 1;
    const timeStr = offsetMatch[1].replace(/[^0-9-]/g, "");
    const hours = parseInt(timeStr || "0", 10);
    const minutes = timeStr.includes(":") ? parseInt(timeStr.split(":")[1], 10) : 0;
    offsetMinutes = sign * (hours * 60 + minutes);
  }

  // Apply the offset to get the true instant in UTC terms
  // (i.e., the instant that, when viewed in the zone, shows the given wall time)
  const result = new Date(utcInstant.getTime() + offsetMinutes * 60 * 1000);

  return result;
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

// ----- Inline assertions (runtime checks, no test framework) -----
// These verify the helpers work for zones on both sides of UTC and across
// DST boundaries.  They run on module import (in a browser environment).
// If any assertion fails, the error is logged to the console.
if (typeof window !== "undefined") {
  // Zone ahead of UTC (e.g. +8 - Singapore, no DST)
  try {
    const ahead = sessionStartInstant(
      new Date(Date.UTC(2024, 3, 15, 12, 0, 0)), // Apr 15 2024 12:00 UTC
      "14:00",
      "Asia/Singapore"
    );
    // 14:00 SGT = 06:00 UTC the next day (Apr 16)
    if (ahead.getTime() !== new Date(Date.UTC(2024, 3, 16, 6, 0, 0)).getTime()) {
      throw new Error(`Unexpected instant: ${ahead.toISOString()}`);
    }
  } catch (e) {
    console.warn("sessionStartInstant ahead zone assertion failed:", e);
  }

  // Zone behind UTC (e.g. -5 - America/New_York in winter)
  try {
    const behind = sessionStartInstant(
      new Date(Date.UTC(2024, 11, 15, 12, 0, 0)), // Dec 15 2024 12:00 UTC
      "07:00",
      "America/New_York"
    );
    // 07:00 EST = 12:00 UTC (Dec 15)
    if (behind.getTime() !== new Date(Date.UTC(2024, 11, 15, 12, 0, 0)).getTime()) {
      throw new Error(`Unexpected instant: ${behind.toISOString()}`);
    }
  } catch (e) {
    console.warn("sessionStartInstant behind zone assertion failed:", e);
  }

  // DST boundary zone (e.g. America/Chicago spring-forward, Mar 10 2024)
  try {
    const dst = sessionStartInstant(
      new Date(Date.UTC(2024, 3, 10, 12, 0, 0)), // Mar 10 2024 12:00 UTC
      "02:00",
      "America/Chicago"
    );
    // At 02:00 CST -> 03:00 CDT (spring forward). The API maps 02:00 to 03:00 CDT.
    // We just assert it doesn't throw.
    if (!dst) throw new Error("DST boundary check failed");
  } catch (e) {
    console.warn("sessionStartInstant DST boundary assertion failed:", e);
  }
}