import type { calendar_v3 } from "googleapis";
import type { EventType } from "@calendar-planner/shared";
import { buildGoogleCalendarClient } from "./client.js";
import { mapGoogleEventType } from "../../domain/event-type.js";

export interface GoogleCalendarClient {
  events: {
    get?: (
      params: calendar_v3.Params$Resource$Events$Get,
    ) => Promise<{ data: calendar_v3.Schema$Event }>;
    insert: (
      params: calendar_v3.Params$Resource$Events$Insert,
    ) => Promise<{ data: calendar_v3.Schema$Event }>;
    update: (
      params: calendar_v3.Params$Resource$Events$Update,
    ) => Promise<{ data: calendar_v3.Schema$Event }>;
    delete: (
      params: calendar_v3.Params$Resource$Events$Delete,
    ) => Promise<{ data: void }>;
  };
}

export interface CreateEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  type?: EventType;
}

export interface UpdateEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  type?: EventType;
}

function eventTypeExtendedProperties(type?: EventType):
  | { private: { eventType: EventType } }
  | undefined {
  if (!type) return undefined;
  return { private: { eventType: type } };
}

export interface CreatedEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
}

export type UpdatedEvent = CreatedEvent;

export interface FullEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  type?: EventType;
}

/**
 * Fetch a single event with full details from the Owner's primary Google Calendar.
 */
export async function getEvent(
  eventId: string,
  accessToken: string,
  client: GoogleCalendarClient,
): Promise<FullEvent> {
  if (!client.events.get) {
    throw new Error("Google Calendar client does not support get");
  }
  const res = await client.events.get({
    calendarId: "primary",
    eventId,
  });

  const ev = res.data;
  const privateType = ev.extendedProperties?.private?.["eventType"];
  return {
    id: ev.id ?? eventId,
    summary: ev.summary ?? undefined,
    description: ev.description ?? undefined,
    location: ev.location ?? undefined,
    start: ev.start
      ? { dateTime: ev.start.dateTime ?? undefined, date: ev.start.date ?? undefined }
      : undefined,
    end: ev.end
      ? { dateTime: ev.end.dateTime ?? undefined, date: ev.end.date ?? undefined }
      : undefined,
    type: mapGoogleEventType(ev.eventType, privateType),
  };
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
      ...(input.type && { extendedProperties: eventTypeExtendedProperties(input.type) }),
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

/**
 * Update an existing event in the Owner's primary Google Calendar.
 */
export async function updateEvent(
  eventId: string,
  input: UpdateEventInput,
  accessToken: string,
  client: GoogleCalendarClient,
): Promise<UpdatedEvent> {
  const res = await client.events.update({
    calendarId: "primary",
    eventId,
    sendUpdates: "none",
    requestBody: {
      summary: input.summary,
      ...(input.description && { description: input.description }),
      ...(input.location && { location: input.location }),
      start: { dateTime: input.start },
      end: { dateTime: input.end },
      transparency: "opaque",
      reminders: { useDefault: true },
      ...(input.type && { extendedProperties: eventTypeExtendedProperties(input.type) }),
    },
  });

  const ev = res.data;
  return {
    id: ev.id ?? eventId,
    summary: ev.summary ?? undefined,
    start: ev.start ? { dateTime: ev.start.dateTime ?? undefined } : undefined,
    end: ev.end ? { dateTime: ev.end.dateTime ?? undefined } : undefined,
  };
}

/**
 * Hard-delete an event from the Owner's primary Google Calendar.
 */
export async function deleteEvent(
  eventId: string,
  accessToken: string,
  client: GoogleCalendarClient,
): Promise<void> {
  await client.events.delete({
    calendarId: "primary",
    eventId,
    sendUpdates: "none",
  });
}

/** Build an authenticated googleapis calendar client from an access token. */
export function buildEventsClient(accessToken: string): GoogleCalendarClient {
  return buildGoogleCalendarClient(accessToken) as GoogleCalendarClient;
}
