import type { calendar_v3 } from "googleapis";
import type { EventType } from "@calendar-planner/shared";
import { buildGoogleCalendarClient } from "./client.js";
import { mapGoogleEventType } from "../../domain/event-type.js";

export interface GoogleEventsClient {
  calendarList: {
    list: (params: calendar_v3.Params$Resource$Calendarlist$List) => Promise<{
      data: calendar_v3.Schema$CalendarList;
    }>;
  };
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
  type: EventType;
}

interface RawItem {
  id?: string;
  calendarId?: string;
  summary?: string;
  description?: string;
  eventType?: string;
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
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
  const privateType = item.extendedProperties?.private?.["eventType"];
  return {
    id: item.id,
    calendarId: item.calendarId ?? "",
    summary: item.summary ?? "(без названия)",
    description: item.description ?? undefined,
    start,
    end,
    allDay,
    type: mapGoogleEventType(item.eventType, privateType),
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
  client: GoogleEventsClient,
): Promise<ListedEvent[]> {
  const listRes = await client.calendarList.list({});
  const calendars = listRes.data.items ?? [];

  const out: ListedEvent[] = [];
  for (const cal of calendars) {
    if (!cal.id) continue;
    const res = await client.events.list({
      calendarId: cal.id,
      timeMin: from,
      timeMax: to,
      singleEvents: true,
      orderBy: "startTime",
    });

    const items = (res.data.items ?? []) as RawItem[];
    for (const item of items) {
      const normalized = normalizeItem({ ...item, calendarId: cal.id });
      if (normalized) out.push(normalized);
    }
  }

  return out;
}

/** Build an authenticated googleapis calendar client from an access token. */
export function buildEventsListClient(accessToken: string): GoogleEventsClient {
  return buildGoogleCalendarClient(accessToken) as GoogleEventsClient;
}
