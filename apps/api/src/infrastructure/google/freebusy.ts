import type { calendar_v3 } from "googleapis";
import { toIsoRange, type Week } from "../../domain/week.js";
import { getLocalTimeZone, groupIntervalsByDay, type BusyMap } from "@calendar-planner/shared";
import { buildGoogleCalendarClient } from "./client.js";

export interface GoogleCalendarClient {
  freebusy: {
    query: (params: calendar_v3.Params$Resource$Freebusy$Query) => Promise<{
      data: calendar_v3.Schema$FreeBusyResponse;
    }>;
  };
}

/**
 * Read free/busy blocks for `week` across all calendars the user has
 * subscribed to. Privacy-first: titles are not fetched. Returns a map
 * keyed by YYYY-MM-DD in `timeZone` with the busy intervals in that day.
 */
export async function getFreeBusy(
  week: Week,
  accessToken: string,
  client: GoogleCalendarClient,
  timeZone: string = getLocalTimeZone(),
): Promise<BusyMap> {
  const { timeMin, timeMax } = toIsoRange(week, timeZone);

  const res = await client.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    },
  });

  const calendars = res.data.calendars ?? {};
  const intervals: Array<{ start: string; end: string }> = [];

  for (const cal of Object.values(calendars)) {
    for (const slot of cal.busy ?? []) {
      if (!slot.start || !slot.end) continue;
      intervals.push({ start: slot.start, end: slot.end });
    }
  }

  return groupIntervalsByDay(intervals, timeZone);
}

/** Build an authenticated googleapis calendar client from an access token. */
export function buildCalendarClient(accessToken: string): GoogleCalendarClient {
  return buildGoogleCalendarClient(accessToken) as GoogleCalendarClient;
}
