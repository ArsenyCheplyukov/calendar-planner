import { describe, it, expect, vi } from "vitest";
import { getEvents, type GoogleEventsClient } from "./getEvents.js";

function makeClient(listMock = vi.fn()): GoogleEventsClient {
  return { events: { list: listMock } };
}

describe("getEvents", () => {
  it("calls events.list with timeMin, timeMax, singleEvents, orderBy, and empty calendarId", async () => {
    const list = vi.fn().mockResolvedValue({ data: { items: [] } });
    const client = makeClient(list);

    await getEvents(
      "2026-07-06T00:00:00.000Z",
      "2026-07-12T23:59:59.999Z",
      "ya29.test",
      client,
    );

    expect(list).toHaveBeenCalledTimes(1);
    const params = list.mock.calls[0]![0];
    expect(params.calendarId).toBe("");
    expect(params.timeMin).toBe("2026-07-06T00:00:00.000Z");
    expect(params.timeMax).toBe("2026-07-12T23:59:59.999Z");
    expect(params.singleEvents).toBe(true);
    expect(params.orderBy).toBe("startTime");
  });

  it("flattens events from all calendars into a single array", async () => {
    const list = vi.fn().mockResolvedValue({
      data: {
        items: [
          {
            id: "evt-1",
            calendarId: "primary",
            summary: "Standup",
            start: { dateTime: "2026-07-08T09:00:00Z" },
            end: { dateTime: "2026-07-08T09:15:00Z" },
          },
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

    const result = await getEvents(
      "2026-07-06T00:00:00.000Z",
      "2026-07-12T23:59:59.999Z",
      "ya29.test",
      makeClient(list),
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "evt-1",
      calendarId: "primary",
      summary: "Standup",
      start: "2026-07-08T09:00:00Z",
      end: "2026-07-08T09:15:00Z",
      allDay: false,
    });
    expect(result[1]?.summary).toBe("Deep work");
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

    const result = await getEvents(
      "2026-07-06T00:00:00.000Z",
      "2026-07-12T23:59:59.999Z",
      "ya29.test",
      makeClient(list),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.allDay).toBe(true);
    expect(result[0]?.start).toBe("2026-07-10");
    expect(result[0]?.end).toBe("2026-07-11");
  });

  it("throws a clear error when the Google API call fails", async () => {
    const list = vi.fn().mockRejectedValue(new Error("403 forbidden"));
    await expect(
      getEvents(
        "2026-07-06T00:00:00.000Z",
        "2026-07-12T23:59:59.999Z",
        "ya29.test",
        makeClient(list),
      ),
    ).rejects.toThrow(/403/);
  });
});
