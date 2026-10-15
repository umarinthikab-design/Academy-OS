import { cache } from "react";
import { prisma } from "./prisma";
import { sessionStartInstant, startOfTodayInZone } from "./time";

// The academy time zone from Club Settings (falls back to UTC). Session
// start times are wall-clock times in this zone, so every "has it started",
// "deadline" and "today" calculation must go through here.
export const getAcademyTimeZone = cache(async (): Promise<string> => {
  const s = await prisma.academySettings.findFirst({ select: { timeZone: true } });
  return s?.timeZone || "UTC";
});

export async function sessionStartAt(session: { date: Date; startTime: string }): Promise<Date> {
  return sessionStartInstant(session.date, session.startTime, await getAcademyTimeZone());
}

export async function todayStartAt(): Promise<Date> {
  return startOfTodayInZone(await getAcademyTimeZone());
}
