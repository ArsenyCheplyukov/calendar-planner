import { describe, it, expect, vi } from "vitest";
import { buildCalendarClient, getFreeBusy } from "./freebusy.js";
import type { Week } from "../../domain/week.js";

function buildWeek(): Week {
  return {
    start: new Date(2026, 6, 6, 0, 0, 0),
    end: new Date(2026, 6, 12, 23, 59, 59, 999),
  };
}

describe("getFreeBusy", () => {
  it("calls freeBusy.query with all calendars (empty items array)", async () => {
    const freebusyQuery = vi.fn().mockResolvedValue({
      data: { calendars: {} },
    });
    const calendarMock = {
      freebusy: { query: freebusyQuery },
    };

    const result = await getFreeBusy(buildWeek(), "ya29.test", calendarMock as never);

    expect(freebusyQuery).toHaveBeenCalledTimes(1);
    const call = freebusyQuery.mock.calls[0]![0];
    expect(call.requestBody.items).toEqual([]);
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
    };
    const result = await getFreeBusy(buildWeek(), "ya29.test", calendarMock as never);
    expect(result).toEqual({});
  });

  it("builds an authenticated Google calendar client lazily", () => {
    const client = buildCalendarClient("ya29.test");
    expect(client.freebusy.query).toBeInstanceOf(Function);
  });
});
