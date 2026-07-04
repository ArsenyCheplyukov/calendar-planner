import { describe, it, expect } from "vitest";
import {
  formatTime,
  formatDayName,
  formatDateLong,
  formatWeekRange,
  formatYmd,
  addDays,
} from "./time-format.js";

describe("time-format adapter", () => {
  it("formats time in the target time zone", () => {
    expect(formatTime("2026-07-08T09:00:00Z", "UTC")).toBe("09:00");
    expect(formatTime("2026-07-08T09:00:00Z", "Europe/Moscow")).toBe("12:00");
  });

  it("formats the short Russian day name", () => {
    expect(formatDayName("2026-07-06T00:00:00Z", "UTC")).toBe("пн");
    expect(formatDayName("2026-07-12T00:00:00Z", "UTC")).toBe("вс");
  });

  it("formats a long Russian date", () => {
    expect(formatDateLong("2026-07-08T09:00:00Z", "UTC")).toBe("среда, 8 июля");
  });

  it("formats a week range within the same month", () => {
    expect(formatWeekRange("2026-07-06T00:00:00Z", "2026-07-12T23:59:59Z", "UTC")).toBe(
      "6 – 12 июля",
    );
  });

  it("formats a week range spanning two months", () => {
    expect(formatWeekRange("2026-06-29T00:00:00Z", "2026-07-05T23:59:59Z", "UTC")).toBe(
      "29 июня – 5 июля",
    );
  });

  it("returns a YYYY-MM-DD string in the target time zone", () => {
    expect(formatYmd(new Date("2026-07-08T09:00:00Z"), "UTC")).toBe("2026-07-08");
  });

  it("adds days using time-zone-aware arithmetic", () => {
    const result = addDays("2026-07-06T00:00:00Z", 6, "UTC");
    expect(formatYmd(result, "UTC")).toBe("2026-07-12");
  });
});
