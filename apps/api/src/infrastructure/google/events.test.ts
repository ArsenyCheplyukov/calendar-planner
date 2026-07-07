import { describe, it, expect, vi } from "vitest";
import {
  buildEventsClient,
  createEvent,
  deleteEvent,
  updateEvent,
  type GoogleCalendarClient,
} from "./events.js";

function makeClient(insertMock = vi.fn()): GoogleCalendarClient {
  return {
    events: {
      insert: insertMock,
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe("createEvent", () => {
  it("calls events.insert with calendarId=primary and the right request body", async () => {
    const insert = vi.fn().mockResolvedValue({
      data: {
        id: "evt-1",
        summary: "Подготовить презентацию",
        start: { dateTime: "2026-07-08T09:00:00Z" },
        end: { dateTime: "2026-07-08T10:00:00Z" },
      },
    });
    const client = makeClient(insert);

    const result = await createEvent(
      {
        summary: "Подготовить презентацию",
        description: "prepare slides\n\n---\nCreated via calendar-planner",
        start: "2026-07-08T09:00:00Z",
        end: "2026-07-08T10:00:00Z",
      },
      "ya29.test",
      client,
    );

    expect(insert).toHaveBeenCalledTimes(1);
    const [params] = insert.mock.calls[0]!;
    expect(params.calendarId).toBe("primary");
    expect(params.sendUpdates).toBe("none");
    expect(params.requestBody).toEqual({
      summary: "Подготовить презентацию",
      description: "prepare slides\n\n---\nCreated via calendar-planner",
      start: { dateTime: "2026-07-08T09:00:00Z" },
      end: { dateTime: "2026-07-08T10:00:00Z" },
      transparency: "opaque",
      reminders: { useDefault: true },
    });
    expect(result.id).toBe("evt-1");
  });

  it("passes useDefault reminders so Google Calendar defaults apply", async () => {
    const insert = vi.fn().mockResolvedValue({ data: { id: "evt-1" } });
    await createEvent(
      {
        summary: "x",
        description: "y",
        start: "2026-07-08T09:00:00Z",
        end: "2026-07-08T10:00:00Z",
      },
      "ya29.test",
      makeClient(insert),
    );
    const [params] = insert.mock.calls[0]!;
    expect(params.requestBody.reminders).toEqual({ useDefault: true });
  });

  it("stores the domain event type in extendedProperties when provided", async () => {
    const insert = vi.fn().mockResolvedValue({ data: { id: "evt-1" } });
    await createEvent(
      {
        summary: "x",
        description: "y",
        start: "2026-07-08T09:00:00Z",
        end: "2026-07-08T10:00:00Z",
        type: "focus",
      },
      "ya29.test",
      makeClient(insert),
    );
    const [params] = insert.mock.calls[0]!;
    expect(params.requestBody.extendedProperties).toEqual({
      private: { eventType: "focus" },
    });
  });

  it("throws a clear error when the Google API call fails", async () => {
    const insert = vi.fn().mockResolvedValue({ data: { id: "evt-1" } });
    insert.mockRejectedValue(new Error("403 forbidden"));
    await expect(
      createEvent(
        { summary: "x", description: "y", start: "a", end: "b" },
        "ya29.test",
        makeClient(insert),
      ),
    ).rejects.toThrow(/403/);
  });

  it("builds an authenticated Google calendar client lazily", () => {
    const client = buildEventsClient("ya29.test");
    expect(client.events.insert).toBeInstanceOf(Function);
  });
});

describe("updateEvent", () => {
  it("calls events.update with calendarId=primary and the right request body", async () => {
    const update = vi.fn().mockResolvedValue({
      data: {
        id: "evt-1",
        summary: "Updated",
        start: { dateTime: "2026-07-08T10:00:00Z" },
        end: { dateTime: "2026-07-08T11:00:00Z" },
      },
    });
    const client: GoogleCalendarClient = {
      events: { get: vi.fn(), insert: vi.fn(), update, delete: vi.fn() },
    };

    const result = await updateEvent(
      "evt-1",
      {
        summary: "Updated",
        description: "updated desc",
        location: "updated loc",
        start: "2026-07-08T10:00:00Z",
        end: "2026-07-08T11:00:00Z",
      },
      "ya29.test",
      client,
    );

    expect(update).toHaveBeenCalledTimes(1);
    const [params] = update.mock.calls[0]!;
    expect(params.calendarId).toBe("primary");
    expect(params.eventId).toBe("evt-1");
    expect(params.sendUpdates).toBe("none");
    expect(params.requestBody).toEqual({
      summary: "Updated",
      description: "updated desc",
      location: "updated loc",
      start: { dateTime: "2026-07-08T10:00:00Z" },
      end: { dateTime: "2026-07-08T11:00:00Z" },
      transparency: "opaque",
      reminders: { useDefault: true },
    });
    expect(result.id).toBe("evt-1");
    expect(result.summary).toBe("Updated");
  });
});

describe("deleteEvent", () => {
  it("calls events.delete with calendarId=primary and the event id", async () => {
    const del = vi.fn().mockResolvedValue({ data: undefined });
    const client: GoogleCalendarClient = {
      events: { get: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: del },
    };

    await deleteEvent("evt-1", "ya29.test", client);

    expect(del).toHaveBeenCalledTimes(1);
    const [params] = del.mock.calls[0]!;
    expect(params.calendarId).toBe("primary");
    expect(params.eventId).toBe("evt-1");
    expect(params.sendUpdates).toBe("none");
  });
});
