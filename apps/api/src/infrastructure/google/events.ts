import type { calendar_v3 } from "googleapis";
import { buildGoogleCalendarClient } from "./client.js";

export interface GoogleCalendarClient {
  events: {
    insert: (
      params: calendar_v3.Params$Resource$Events$Insert,
    ) => Promise<{ data: calendar_v3.Schema$Event }>;
  };
}

export interface CreateEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
}

export interface CreatedEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
}

/**
 * Create a new event in the Owner's primary Google Calendar.
 * Privacy-first: no attendees, no reminders override, opaque (busy) status.
 */
export async function createEvent(
  input: CreateEventInput,
  accessToken: string,
  client: GoogleCalendarClient,
): Promise<CreatedEvent> {
  const res = await client.events.insert({
    calendarId: "primary",
    sendUpdates: "none",
    requestBody: {
      summary: input.summary,
      ...(input.description && { description: input.description }),
      ...(input.location && { location: input.location }),
      start: { dateTime: input.start },
      end: { dateTime: input.end },
      transparency: "opaque",
      reminders: { useDefault: true },
    },
  });

  const ev = res.data;
  return {
    id: ev.id ?? "",
    summary: ev.summary ?? undefined,
    start: ev.start ? { dateTime: ev.start.dateTime ?? undefined } : undefined,
    end: ev.end ? { dateTime: ev.end.dateTime ?? undefined } : undefined,
  };
}

/** Build an authenticated googleapis calendar client from an access token. */
export function buildEventsClient(accessToken: string): GoogleCalendarClient {
  return buildGoogleCalendarClient(accessToken) as GoogleCalendarClient;
}
