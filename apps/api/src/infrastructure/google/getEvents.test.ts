import { describe, it, expect, vi } from "vitest";
import { buildEventsListClient, getEvents, type GoogleEventsClient } from "./getEvents.js";

function makeClient(mocks: {
  list?: ReturnType<typeof vi.fn>;
  calendarListList?: ReturnType<typeof vi.fn>;
} = {}): GoogleEventsClient {
  return {
    events: { list: mocks.list ?? vi.fn().mockResolvedValue({ data: { items: [] } }) },
    calendarList: { list: mocks.calendarListList ?? vi.fn().mockResolvedValue({ data: { items: [] } }) },
  };
}

describe("getEvents", () => {
  it("lists calendars and fetches events from each calendar", async () => {
    const list = vi.fn();
    list
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "evt-1",
              calendarId: "primary",
              summary: "Standup",
              start: { dateTime: "2026-07-08T09:00:00Z" },
              end: { dateTime: "2026-07-08T09:15:00Z" },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "evt-2",
              calendarId: "work@group.calendar.google.com",
              summary: "Deep work",
              start: { dateTime: "2026-07-09T10:00:00Z" },
              end: { dateTime: "2026-07-09T12:00:00Z" },
            },
          ],
        },
      });

    const calendarListList = vi.fn().mockResolvedValue({
      data: {
        items: [
          { id: "primary" },
          { id: "work@group.calendar.google.com" },
        ],
      },
    });

    const client = makeClient({ list, calendarListList });

    const result = await getEvents(
      "2026-07-06T00:00:00.000Z",
      "2026-07-12T23:59:59.999Z",
      client,
    );

    expect(calendarListList).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(2);

    const firstCall = list.mock.calls[0]![0];
    expect(firstCall.calendarId).toBe("primary");
    expect(firstCall.timeMin).toBe("2026-07-06T00:00:00.000Z");
    expect(firstCall.timeMax).toBe("2026-07-12T23:59:59.999Z");
    expect(firstCall.singleEvents).toBe(true);
    expect(firstCall.orderBy).toBe("startTime");

    const secondCall = list.mock.calls[1]![0];
    expect(secondCall.calendarId).toBe("work@group.calendar.google.com");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "evt-1",
      summary: "Standup",
      start: "2026-07-08T09:00:00Z",
      end: "2026-07-08T09:15:00Z",
      allDay: false,
      type: "meeting",
    });
    expect(result[1]?.summary).toBe("Deep work");
  });

  it("returns an empty array when the owner has no calendars", async () => {
    const client = makeClient();
    const result = await getEvents(
      "2026-07-06T00:00:00.000Z",
      "2026-07-12T23:59:59.999Z",
      client,
    );
    expect(result).toEqual([]);
  });

  it("maps Google eventType to a domain type", async () => {
    const list = vi.fn().mockResolvedValue({
      data: {
        items: [
          {
            id: "evt-focus",
            calendarId: "primary",
            summary: "Focus block",
            eventType: "focusTime",
            start: { dateTime: "2026-07-08T09:00:00Z" },
            end: { dateTime: "2026-07-08T10:00:00Z" },
          },
        ],
      },
    });
    const calendarListList = vi.fn().mockResolvedValue({
      data: { items: [{ id: "primary" }] },
    });

    const client = makeClient({ list, calendarListList });
    const result = await getEvents(
      "2026-07-06T00:00:00.000Z",
      "2026-07-12T23:59:59.999Z",
      client,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("focus");
  });

  it("prefers a privately stored domain type over Google eventType", async () => {
    const list = vi.fn().mockResolvedValue({
      data: {
        items: [
          {
            id: "evt-private",
            calendarId: "primary",
            summary: "Errand",
            eventType: "default",
            extendedProperties: { private: { eventType: "errand" } },
            start: { dateTime: "2026-07-08T09:00:00Z" },
            end: { dateTime: "2026-07-08T10:00:00Z" },
          },
        ],
      },
    });
    const calendarListList = vi.fn().mockResolvedValue({
      data: { items: [{ id: "primary" }] },
    });

    const client = makeClient({ list, calendarListList });
    const result = await getEvents(
      "2026-07-06T00:00:00.000Z",
      "2026-07-12T23:59:59.999Z",
      client,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("errand");
  });

  it("marks allDay events correctly", async () => {
    const list = vi.fn().mockResolvedValue({
      data: {
        items: [
          {
            id: "evt-3",
            calendarId: "primary",
            summary: "Out of office",
            start: { date: "2026-07-10" },
            end: { date: "2026-07-11" },
          },
        ],
      },
    });
    const calendarListList = vi.fn().mockResolvedValue({
      data: { items: [{ id: "primary" }] },
    });

    const client = makeClient({ list, calendarListList });
    const result = await getEvents(
      "2026-07-06T00:00:00.000Z",
      "2026-07-12T23:59:59.999Z",
      client,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.allDay).toBe(true);
    expect(result[0]?.start).toBe("2026-07-10");
    expect(result[0]?.end).toBe("2026-07-11");
  });

  it("throws a clear error when the Google API call fails", async () => {
    const list = vi.fn().mockRejectedValue(new Error("403 forbidden"));
    const calendarListList = vi.fn().mockResolvedValue({
      data: { items: [{ id: "primary" }] },
    });
    const client = makeClient({ list, calendarListList });
    await expect(
      getEvents(
        "2026-07-06T00:00:00.000Z",
        "2026-07-12T23:59:59.999Z",
        client,
      ),
    ).rejects.toThrow(/403/);
  });

  it("builds an authenticated Google calendar client lazily", () => {
    const client = buildEventsListClient("ya29.test");
    expect(client.events.list).toBeInstanceOf(Function);
    expect(client.calendarList.list).toBeInstanceOf(Function);
  });
});
