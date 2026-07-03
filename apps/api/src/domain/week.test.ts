import { describe, it, expect } from "vitest";
import { currentWeek, nextWeek, previousWeek, toIsoRange, type Week } from "./week.js";

/** Format a Date as YYYY-MM-DD in local time. */
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localDateTimeKey(d: Date): string {
  const date = localDateKey(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
}

describe("currentWeek", () => {
  it("returns the Mon–Sun week containing a Wednesday", () => {
    // 2026-07-01 is a Wednesday in any TZ
    const wed = new Date(2026, 6, 1, 15, 0, 0); // local time
    const week = currentWeek(wed);

    expect(week.start.getDay()).toBe(1); // Monday
    expect(week.end.getDay()).toBe(0); // Sunday
    expect(localDateKey(week.start)).toBe("2026-06-29");
    expect(localDateKey(week.end)).toBe("2026-07-05");
  });

  it("returns the Mon–Sun week containing the Monday itself", () => {
    const mon = new Date(2026, 6, 6, 0, 0, 0);
    const week = currentWeek(mon);

    expect(localDateKey(week.start)).toBe("2026-07-06");
    expect(localDateKey(week.end)).toBe("2026-07-12");
  });

  it("returns the Mon–Sun week containing a Sunday at 00:00 (Sunday treated as 'current' since it's the start of a new week)", () => {
    // 2026-07-05 00:00 is the boundary — the new week hasn't really "begun" yet
    // from a planning perspective. The rule says "if today is Sunday, jump to next week",
    // which applies at any time on Sunday, including 00:00.
    const sunMidnight = new Date(2026, 6, 5, 0, 0, 0);
    const week = currentWeek(sunMidnight);

    expect(localDateKey(week.start)).toBe("2026-07-06");
    expect(localDateKey(week.end)).toBe("2026-07-12");
  });

  it("when today is Saturday, returns the NEXT Mon–Sun week", () => {
    const sat = new Date(2026, 6, 4, 10, 0, 0);
    const week = currentWeek(sat);

    expect(localDateKey(week.start)).toBe("2026-07-06");
    expect(localDateKey(week.end)).toBe("2026-07-12");
  });

  it("when today is Sunday, returns the NEXT Mon–Sun week", () => {
    const sun = new Date(2026, 6, 5, 10, 0, 0);
    const week = currentWeek(sun);

    expect(localDateKey(week.start)).toBe("2026-07-06");
    expect(localDateKey(week.end)).toBe("2026-07-12");
  });
});

describe("previousWeek / nextWeek", () => {
  const sample: Week = {
    start: new Date(2026, 6, 6, 0, 0, 0),
    end: new Date(2026, 6, 12, 23, 59, 59, 999),
  };

  it("previousWeek shifts by 7 days earlier", () => {
    const prev = previousWeek(sample);
    expect(localDateKey(prev.start)).toBe("2026-06-29");
    expect(localDateKey(prev.end)).toBe("2026-07-05");
  });

  it("nextWeek shifts by 7 days later", () => {
    const next = nextWeek(sample);
    expect(localDateKey(next.start)).toBe("2026-07-13");
    expect(localDateKey(next.end)).toBe("2026-07-19");
  });

  it("previousWeek does not mutate the input Week", () => {
    const originalStart = sample.start.getTime();
    const originalEnd = sample.end.getTime();
    previousWeek(sample);
    expect(sample.start.getTime()).toBe(originalStart);
    expect(sample.end.getTime()).toBe(originalEnd);
  });

  it("nextWeek does not mutate the input Week", () => {
    const originalStart = sample.start.getTime();
    const originalEnd = sample.end.getTime();
    nextWeek(sample);
    expect(sample.start.getTime()).toBe(originalStart);
    expect(sample.end.getTime()).toBe(originalEnd);
  });

  it("previousWeek returns new Date instances", () => {
    const prev = previousWeek(sample);
    expect(prev.start).not.toBe(sample.start);
    expect(prev.end).not.toBe(sample.end);
  });
});

describe("toIsoRange", () => {
  it("emits RFC3339 timestamps with timezone offset (no Z)", () => {
    const week: Week = {
      start: new Date(2026, 6, 6, 0, 0, 0),
      end: new Date(2026, 6, 12, 23, 59, 59, 999),
    };
    const range = toIsoRange(week);

    expect(range.timeMin).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}:\d{2}$/);
    expect(range.timeMax).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
    expect(range.timeMin.endsWith("Z")).toBe(false);
  });

  it("timeMin is at local midnight on the Monday", () => {
    const week: Week = {
      start: new Date(2026, 6, 6, 0, 0, 0),
      end: new Date(2026, 6, 12, 23, 59, 59, 999),
    };
    const range = toIsoRange(week);
    // strip offset to compare local clock time
    const localPart = range.timeMin.replace(/[+-]\d{2}:\d{2}$/, "");
    expect(localPart).toBe("2026-07-06T00:00:00");
  });
});
