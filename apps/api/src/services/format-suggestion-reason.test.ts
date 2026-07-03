import { describe, it, expect } from "vitest";
import { formatSuggestionReason } from "./format-suggestion-reason.js";
import type { ScoredSlot, EventType } from "@calendar-planner/shared";

function scoredSlot(start: string, end: string, score: number): ScoredSlot {
  return { start, end, score };
}

describe("formatSuggestionReason", () => {
  it("formats a Russian reason with day, time, duration and type", () => {
    const slot = scoredSlot("2026-07-08T09:00:00.000Z", "2026-07-08T10:00:00.000Z", 0.8);
    const reason = formatSuggestionReason(slot, "focus", "Europe/Moscow");
    expect(reason).toMatch(/[а-яё]/i);
    expect(reason).toContain("ср");
    // 09:00 UTC -> 12:00 Europe/Moscow (UTC+3 in July)
    expect(reason).toContain("12:00");
    expect(reason).toContain("13:00");
    expect(reason).toContain("60 мин");
    expect(reason).toContain("фокус-работа");
  });

  it.each<[EventType, string]>([
    ["focus", "фокус-работа"],
    ["meeting", "митинг"],
    ["personal", "личное"],
    ["errand", "поручение"],
  ])("uses the correct type label for %s", (type, label) => {
    const slot = scoredSlot("2026-07-08T09:00:00.000Z", "2026-07-08T10:00:00.000Z", 0.8);
    const reason = formatSuggestionReason(slot, type, "Europe/Moscow");
    expect(reason).toContain(label);
  });
});
