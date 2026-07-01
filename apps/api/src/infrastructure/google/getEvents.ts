import type { calendar_v3 } from "googleapis";

export interface GoogleEventsClient {
  events: {
    list: (params: calendar_v3.Params$Resource$Events$List) => Promise<{
      data: calendar_v3.Schema$Events;
    }>;
  };
}

export interface ListedEvent {
  id: string;
  calendarId: string;
  summary: string;
  description?: string;
  start: string; // ISO datetime OR YYYY-MM-DD for all-day
  end: string;
  allDay: boolean;
}

interface RawItem {
  id?: string;
  calendarId?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

function normalizeItem(item: RawItem): ListedEvent | null {
  if (!item.id) return null;
  const startDateTime = item.start?.dateTime;
  const startDate = item.start?.date;
  const endDateTime = item.end?.dateTime;
  const endDate = item.end?.date;
  const allDay = !startDateTime && !!startDate;
  const start = startDateTime ?? startDate;
  const end = endDateTime ?? endDate;
  if (!start || !end) return null;
  return {
    id: item.id,
    calendarId: item.calendarId ?? "",
    summary: item.summary ?? "(без названия)",
    description: item.description ?? undefined,
    start,
    end,
    allDay,
  };
}

/**
 * Privacy-first: fetch event titles for a given window across all calendars
 * the Owner has subscribed to. The caller is responsible for keeping the
 * window small (typically a single busy block from the free/busy view).
 */
export async function getEvents(
  from: string,
  to: string,
  accessToken: string,
  client: GoogleEventsClient,
): Promise<ListedEvent[]> {
  const res = await client.events.list({
    calendarId: "",
    timeMin: from,
    timeMax: to,
    singleEvents: true,
    orderBy: "startTime",
  });

  const items = (res.data.items ?? []) as RawItem[];
  const out: ListedEvent[] = [];
  for (const item of items) {
    const normalized = normalizeItem(item);
    if (normalized) out.push(normalized);
  }
  return out;
}

/** Build an authenticated googleapis calendar client from an access token. */
export function buildEventsListClient(accessToken: string): GoogleEventsClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { google } = require("googleapis") as typeof import("googleapis");
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}
