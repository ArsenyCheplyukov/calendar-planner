import { describe, it, expect, vi } from "vitest";
import { suggestSlotCandidates, type PlanCandidatesParser, type CalendarClientFactory } from "./suggest-slots.js";
import { DEFAULT_PREFERENCES } from "@calendar-planner/shared";
import type { PreferencesStore } from "../infrastructure/preferences/store.js";
import type { ParsedPlan, Preferences } from "@calendar-planner/shared";

function fakeStore(partial?: Partial<Preferences>): PreferencesStore {
  return {
    getPreferences: async () => ({ ...DEFAULT_PREFERENCES, ...partial }),
    updatePreferences: async (p: Partial<Preferences>) => ({ ...DEFAULT_PREFERENCES, ...partial, ...p }),
  } as unknown as PreferencesStore;
}

const fakeCalendarFactory: CalendarClientFactory = () =>
  ({
    freebusy: {
      query: async () => ({ data: { calendars: {} } }),
    },
    calendarList: {
      list: async () => ({ data: { items: [] } }),
    },
  }) as never;

const basePlan: ParsedPlan = {
  title: "Focus block",
  durationMinutes: 60,
  type: "focus",
  deadline: null,
  hint: null,
};

describe("suggestSlotCandidates", () => {
  it("scores multiple candidates and selects the first one", async () => {
    const parsePlanCandidates: PlanCandidatesParser = async () => [
      { ...basePlan, title: "Focus Monday", hint: { window: { dayOfWeek: "mon" } } },
      { ...basePlan, title: "Focus Wednesday", hint: { window: { dayOfWeek: "wed" } } },
    ];

    const result = await suggestSlotCandidates(
      { text: "focus block", startDate: "2026-07-06", timeZone: "Europe/Moscow" },
      {
        parsePlanCandidates,
        calendarClientFactory: fakeCalendarFactory,
        getAccessToken: async () => "ya29.test",
        preferencesStore: fakeStore(),
      },
    );

    expect(result.candidates).toHaveLength(2);
    expect(result.selectedCandidateId).toBe(result.candidates[0]?.candidateId);
    expect(result.candidates[0]?.rank).toBe(1);
    expect(result.candidates[1]?.rank).toBe(2);
    expect(result.candidates[0]?.parsedPlan.title).toBe("Focus Monday");
    expect(result.candidates[1]?.parsedPlan.title).toBe("Focus Wednesday");
    expect(result.parsed).toEqual(result.candidates[0]?.parsedPlan);
    expect(result.suggestions).toEqual(result.candidates[0]?.suggestions);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("handles a single candidate", async () => {
    const parsePlanCandidates: PlanCandidatesParser = async () => [basePlan];

    const result = await suggestSlotCandidates(
      { text: "focus block", startDate: "2026-07-06", timeZone: "Europe/Moscow" },
      {
        parsePlanCandidates,
        calendarClientFactory: fakeCalendarFactory,
        getAccessToken: async () => null,
        preferencesStore: fakeStore(),
      },
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.selectedCandidateId).toBe(result.candidates[0]?.candidateId);
    expect(result.candidates[0]?.parsedPlan).toEqual(basePlan);
  });

  it("throws when the parser returns no candidates", async () => {
    const parsePlanCandidates: PlanCandidatesParser = async () => [];

    await expect(
      suggestSlotCandidates(
        { text: "focus block", startDate: "2026-07-06", timeZone: "Europe/Moscow" },
        {
          parsePlanCandidates,
          calendarClientFactory: fakeCalendarFactory,
          getAccessToken: async () => null,
          preferencesStore: fakeStore(),
        },
      ),
    ).rejects.toThrow("Plan parser returned no valid candidates");
  });

  it("uses hint.window.date as the planning anchor for an explicit Saturday", async () => {
    const parsePlanCandidates: PlanCandidatesParser = async () => [
      { ...basePlan, type: "meeting", hint: { window: { date: "2026-07-04" } } },
    ];

    const result = await suggestSlotCandidates(
      { text: "meeting today", timeZone: "Europe/Moscow" },
      {
        parsePlanCandidates,
        calendarClientFactory: fakeCalendarFactory,
        getAccessToken: async () => null,
        preferencesStore: fakeStore(),
      },
    );

    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0]!.start).toMatch(/^2026-07-04/);
  });

  it("uses hint.window.date as the planning anchor for an explicit Sunday", async () => {
    const parsePlanCandidates: PlanCandidatesParser = async () => [
      { ...basePlan, type: "meeting", hint: { window: { date: "2026-07-05" } } },
    ];

    const result = await suggestSlotCandidates(
      { text: "meeting tomorrow", timeZone: "Europe/Moscow" },
      {
        parsePlanCandidates,
        calendarClientFactory: fakeCalendarFactory,
        getAccessToken: async () => null,
        preferencesStore: fakeStore(),
      },
    );

    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0]!.start).toMatch(/^2026-07-05/);
  });

  it("anchors to today on Saturday when no date hint is given", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.setSystemTime(new Date("2026-07-04T10:00:00Z"));

    const parsePlanCandidates: PlanCandidatesParser = async () => [
      { ...basePlan, type: "meeting", hint: null },
    ];

    const result = await suggestSlotCandidates(
      { text: "meeting", timeZone: "Europe/Moscow" },
      {
        parsePlanCandidates,
        calendarClientFactory: fakeCalendarFactory,
        getAccessToken: async () => null,
        preferencesStore: fakeStore(),
      },
    );

    // The search week must include today (Saturday) instead of jumping to next week.
    const dates = result.suggestions.map((s) => s.start.slice(0, 10));
    expect(dates).toContain("2026-07-04");

    vi.useRealTimers();
  });

  it("anchors dayOfWeek hint to today when today matches the requested day", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.setSystemTime(new Date("2026-07-04T10:00:00Z"));

    const parsePlanCandidates: PlanCandidatesParser = async () => [
      { ...basePlan, type: "meeting", hint: { window: { dayOfWeek: "sat" } } },
    ];

    const result = await suggestSlotCandidates(
      { text: "meeting on Saturday", timeZone: "Europe/Moscow" },
      {
        parsePlanCandidates,
        calendarClientFactory: fakeCalendarFactory,
        getAccessToken: async () => null,
        preferencesStore: fakeStore(),
      },
    );

    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0]!.start).toMatch(/^2026-07-04/);

    vi.useRealTimers();
  });

  it("returns all scored suggestions instead of hardcoded top 3", async () => {
    const parsePlanCandidates: PlanCandidatesParser = async () => [
      { ...basePlan, type: "meeting", hint: null },
    ];

    const result = await suggestSlotCandidates(
      { text: "meeting", startDate: "2026-07-06", timeZone: "Europe/Moscow" },
      {
        parsePlanCandidates,
        calendarClientFactory: fakeCalendarFactory,
        getAccessToken: async () => null,
        preferencesStore: fakeStore(),
      },
    );

    // One viable slot per day across the Mon–Sun week = 7 suggestions.
    expect(result.suggestions.length).toBe(7);
  });
});
