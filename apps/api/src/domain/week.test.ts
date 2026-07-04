import { describe, it, expect } from "vitest";
import { currentWeek, nextWeek, previousWeek, toIsoRange, resolveAnchorDate, type Week } from "./week.js";

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

  it("returns the Mon–Sun week containing a Sunday", () => {
    const sunMidnight = new Date(2026, 6, 5, 0, 0, 0);
    const week = currentWeek(sunMidnight);

    expect(localDateKey(week.start)).toBe("2026-06-29");
    expect(localDateKey(week.end)).toBe("2026-07-05");
  });

  it("when today is Saturday, returns the CURRENT Mon–Sun week", () => {
    const sat = new Date(2026, 6, 4, 10, 0, 0);
    const week = currentWeek(sat);

    expect(localDateKey(week.start)).toBe("2026-06-29");
    expect(localDateKey(week.end)).toBe("2026-07-05");
  });

  it("when today is Sunday, returns the CURRENT Mon–Sun week", () => {
    const sun = new Date(2026, 6, 5, 10, 0, 0);
    const week = currentWeek(sun);

    expect(localDateKey(week.start)).toBe("2026-06-29");
    expect(localDateKey(week.end)).toBe("2026-07-05");
  });
});

describe("resolveAnchorDate", () => {
  it("uses hint.window.date when present", () => {
    const ref = new Date(2026, 6, 4, 10, 0, 0); // Saturday
    const d = resolveAnchorDate({ window: { date: "2026-07-08" } }, ref, "UTC");
    expect(localDateKey(d)).toBe("2026-07-08");
  });

  it("resolves dayOfWeek to the nearest future occurrence including today", () => {
    const sat = new Date(2026, 6, 4, 10, 0, 0); // Saturday
    const d = resolveAnchorDate({ window: { dayOfWeek: "sat" } }, sat, "UTC");
    expect(localDateKey(d)).toBe("2026-07-04");
  });

  it("resolves dayOfWeek to the next occurrence when today is a different day", () => {
    const fri = new Date(2026, 6, 3, 10, 0, 0); // Friday
    const d = resolveAnchorDate({ window: { dayOfWeek: "sun" } }, fri, "UTC");
    expect(localDateKey(d)).toBe("2026-07-05");
  });

  it("falls back to the reference date when no hint is given", () => {
    const sat = new Date(2026, 6, 4, 10, 0, 0); // Saturday
    const d = resolveAnchorDate(null, sat, "UTC");
    expect(localDateKey(d)).toBe("2026-07-04");
  });

  it("falls back to the reference date when hint has no window", () => {
    const sat = new Date(2026, 6, 4, 10, 0, 0); // Saturday
    const d = resolveAnchorDate({}, sat, "UTC");
    expect(localDateKey(d)).toBe("2026-07-04");
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
