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
  calendarList: {
    list: (params: calendar_v3.Params$Resource$Calendarlist$List) => Promise<{
      data: calendar_v3.Schema$CalendarList;
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

  let items: Array<{ id: string }>;
  try {
    const listRes = await client.calendarList.list({});
    const calendars = listRes.data.items ?? [];
    items = calendars
      .map((cal) => (cal.id ? { id: cal.id } : null))
      .filter((item): item is { id: string } => item !== null);
  } catch (e) {
    // Privacy-first fallback: if the token cannot list calendars (e.g. it only
    // has the freebusy/events scopes), still query the primary calendar instead
    // of crashing the week view with a 502.
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`calendarList.list failed, falling back to primary calendar: ${message}`);
    items = [{ id: "primary" }];
  }

  const res = await client.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items,
    },
  });

  const freeBusyCalendars = res.data.calendars ?? {};
  const intervals: Array<{ start: string; end: string }> = [];

  for (const cal of Object.values(freeBusyCalendars)) {
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
