import { describe, it, expect, vi } from "vitest";
import { buildCalendarClient, getFreeBusy } from "./freebusy.js";
import type { Week } from "../../domain/week.js";

function buildWeek(): Week {
  return {
    start: new Date(2026, 6, 6, 0, 0, 0),
    end: new Date(2026, 6, 12, 23, 59, 59, 999),
  };
}

function calendarListItem(id: string) {
  return { id, summary: id };
}

describe("getFreeBusy", () => {
  it("queries freebusy for all calendars returned by calendarList.list", async () => {
    const freebusyQuery = vi.fn().mockResolvedValue({
      data: { calendars: {} },
    });
    const calendarList = vi.fn().mockResolvedValue({
      data: {
        items: [calendarListItem("primary"), calendarListItem("work@group.calendar.google.com")],
      },
    });
    const calendarMock = {
      freebusy: { query: freebusyQuery },
      calendarList: { list: calendarList },
    };

    const result = await getFreeBusy(buildWeek(), "ya29.test", calendarMock as never);

    expect(calendarList).toHaveBeenCalledTimes(1);
    expect(freebusyQuery).toHaveBeenCalledTimes(1);
    const call = freebusyQuery.mock.calls[0]![0];
    expect(call.requestBody.items).toEqual([
      { id: "primary" },
      { id: "work@group.calendar.google.com" },
    ]);
    expect(call.requestBody.timeMin).toMatch(/2026-07-06/);
    expect(call.requestBody.timeMax).toMatch(/2026-07-12T23:59/);
    expect(result).toEqual({});
  });

  it("flattens busy intervals from all calendars into a per-day map", async () => {
    const week = buildWeek();
    const day = (d: number) => {
      const date = new Date(2026, 6, d, 12, 0, 0);
      return date.toISOString();
    };

    const calendarMock = {
      freebusy: {
        query: vi.fn().mockResolvedValue({
          data: {
            calendars: {
              primary: {
                busy: [
                  { start: day(6), end: new Date(2026, 6, 6, 13, 0, 0).toISOString() },
                ],
              },
              "work@group.calendar.google.com": {
                busy: [
                  { start: day(7), end: new Date(2026, 6, 7, 11, 0, 0).toISOString() },
                ],
              },
            },
          },
        }),
      },
      calendarList: {
        list: vi.fn().mockResolvedValue({
          data: {
            items: [calendarListItem("primary"), calendarListItem("work@group.calendar.google.com")],
          },
        }),
      },
    };

    const result = await getFreeBusy(week, "ya29.test", calendarMock as never);

    expect(Object.keys(result).sort()).toEqual(["2026-07-06", "2026-07-07"]);
    expect(result["2026-07-06"]).toHaveLength(1);
    expect(result["2026-07-07"]).toHaveLength(1);
    // Each entry has both start and end as ISO strings
    expect(result["2026-07-06"]![0]!.start).toMatch(/^2026-07-06T/);
    expect(result["2026-07-06"]![0]!.end).toMatch(/^2026-07-06T/);
  });

  it("returns an empty map when Google returns no calendars", async () => {
    const calendarMock = {
      freebusy: { query: vi.fn().mockResolvedValue({ data: { calendars: {} } }) },
      calendarList: {
        list: vi.fn().mockResolvedValue({ data: { items: [] } }),
      },
    };
    const result = await getFreeBusy(buildWeek(), "ya29.test", calendarMock as never);
    expect(result).toEqual({});
  });

  it("falls back to the primary calendar when calendarList.list fails", async () => {
    const freebusyQuery = vi.fn().mockResolvedValue({
      data: { calendars: { primary: { busy: [] } } },
    });
    const calendarList = vi.fn().mockRejectedValue(new Error("Insufficient Permission"));
    const calendarMock = {
      freebusy: { query: freebusyQuery },
      calendarList: { list: calendarList },
    };

    const result = await getFreeBusy(buildWeek(), "ya29.test", calendarMock as never);

    expect(calendarList).toHaveBeenCalledTimes(1);
    expect(freebusyQuery).toHaveBeenCalledTimes(1);
    const call = freebusyQuery.mock.calls[0]![0];
    expect(call.requestBody.items).toEqual([{ id: "primary" }]);
    expect(result).toEqual({});
  });

  it("builds an authenticated Google calendar client lazily", () => {
    const client = buildCalendarClient("ya29.test");
    expect(client.freebusy.query).toBeInstanceOf(Function);
  });
});
