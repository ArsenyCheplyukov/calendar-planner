import { calendar_v3 } from "googleapis";
import { createRequire } from "node:module";
import { toIsoRange, type Week } from "../../domain/week.js";

export type BusyMap = Record<string, Array<{ start: string; end: string }>>;

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
 * keyed by local YYYY-MM-DD with the busy intervals in that day.
 */
export async function getFreeBusy(
  week: Week,
  accessToken: string,
  client: GoogleCalendarClient,
): Promise<BusyMap> {
  const { timeMin, timeMax } = toIsoRange(week);

  const res = await client.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [], // empty = all calendars the user has
    },
  });

  const calendars = res.data.calendars ?? {};
  const out: BusyMap = {};

  for (const cal of Object.values(calendars)) {
    for (const slot of cal.busy ?? []) {
      if (!slot.start || !slot.end) continue;
      const dayKey = slot.start.slice(0, 10); // YYYY-MM-DD
      if (!out[dayKey]) out[dayKey] = [];
      out[dayKey].push({ start: slot.start, end: slot.end });
    }
  }

  return out;
}

/** Build an authenticated googleapis calendar client from an access token. */
export function buildCalendarClient(accessToken: string): GoogleCalendarClient {
  // Lazy import: googleapis pulls a large tree; we only need the Calendar surface
  // for now, and lazy loading keeps `tsc --noEmit` fast and tests snappy.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { google } = createRequire(import.meta.url)("googleapis") as typeof import("googleapis");
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}
