import { describe, it, expect } from "vitest";
import { DEFAULT_PREFERENCES } from "@calendar-planner/shared";
import { scoreSlots, mergeWithHint } from "./scorer.js";
import type { Slot, ParsedPlan } from "@calendar-planner/shared";

function slot(start: string, end: string): Slot {
  return { start, end };
}

const planFocus: ParsedPlan = {
  title: "Подготовить презентацию",
  durationMinutes: 60,
  type: "focus",
  deadline: null,
  hint: null,
};

const planMeeting: ParsedPlan = { ...planFocus, type: "meeting" };
const planErrand: ParsedPlan = { ...planFocus, type: "errand" };

describe("mergeWithHint", () => {
  it("returns the preferences unchanged when no hint is provided", () => {
    const merged = mergeWithHint(DEFAULT_PREFERENCES, undefined);
    expect(merged).toEqual(DEFAULT_PREFERENCES);
  });

  it("returns the preferences unchanged when hint is null", () => {
    const merged = mergeWithHint(DEFAULT_PREFERENCES, null);
    expect(merged).toEqual(DEFAULT_PREFERENCES);
  });

  it("returns the preferences unchanged when hint has no overriding fields", () => {
    const merged = mergeWithHint(DEFAULT_PREFERENCES, {});
    expect(merged).toEqual(DEFAULT_PREFERENCES);
  });
});

describe("scoreSlots — type bias", () => {
  it("boosts a focus slot in the morning (09-12) over an afternoon slot", () => {
    const morning = slot("2026-07-08T09:00:00.000Z", "2026-07-08T10:00:00.000Z");
    const afternoon = slot("2026-07-08T14:00:00.000Z", "2026-07-08T15:00:00.000Z");

    const [m] = scoreSlots([morning, afternoon], planFocus, DEFAULT_PREFERENCES);
    const [, a] = scoreSlots([morning, afternoon], planFocus, DEFAULT_PREFERENCES);

    const morningScored = scoreSlots([morning], planFocus, DEFAULT_PREFERENCES)[0]!;
    const afternoonScored = scoreSlots([afternoon], planFocus, DEFAULT_PREFERENCES)[0]!;

    expect(morningScored.score).toBeGreaterThan(afternoonScored.score);
    expect(m!.score).toBeGreaterThanOrEqual(a!.score);
  });

  it("boosts a meeting slot in the middle of the day", () => {
    const morning = slot("2026-07-08T09:00:00.000Z", "2026-07-08T10:00:00.000Z");
    const midday = slot("2026-07-08T13:00:00.000Z", "2026-07-08T14:00:00.000Z");
    const evening = slot("2026-07-08T18:00:00.000Z", "2026-07-08T19:00:00.000Z");

    const morningS = scoreSlots([morning], planMeeting, DEFAULT_PREFERENCES)[0]!;
    const middayS = scoreSlots([midday], planMeeting, DEFAULT_PREFERENCES)[0]!;
    const eveningS = scoreSlots([evening], planMeeting, DEFAULT_PREFERENCES)[0]!;

    expect(middayS.score).toBeGreaterThan(morningS.score);
    expect(middayS.score).toBeGreaterThan(eveningS.score);
  });

  it("boosts an errand slot in the evening", () => {
    const morning = slot("2026-07-08T09:00:00.000Z", "2026-07-08T10:00:00.000Z");
    const evening = slot("2026-07-08T18:00:00.000Z", "2026-07-08T19:00:00.000Z");

    const morningS = scoreSlots([morning], planErrand, DEFAULT_PREFERENCES)[0]!;
    const eveningS = scoreSlots([evening], planErrand, DEFAULT_PREFERENCES)[0]!;

    expect(eveningS.score).toBeGreaterThan(morningS.score);
  });
});

describe("scoreSlots — deadline proximity", () => {
  it("penalises slots that are right on the deadline", () => {
    // Deadline 2026-07-10 17:00. Slot 1 is 2 days before. Slot 2 is on the same day at 16:00.
    const early = slot("2026-07-08T10:00:00.000Z", "2026-07-08T11:00:00.000Z");
    const late = slot("2026-07-10T16:00:00.000Z", "2026-07-10T17:00:00.000Z");

    const earlyS = scoreSlots([early], { ...planFocus, deadline: "2026-07-10T17:00:00.000Z" }, DEFAULT_PREFERENCES)[0]!;
    const lateS = scoreSlots([late], { ...planFocus, deadline: "2026-07-10T17:00:00.000Z" }, DEFAULT_PREFERENCES)[0]!;

    expect(earlyS.score).toBeGreaterThan(lateS.score);
  });
});

describe("scoreSlots — Plan Hint", () => {
  it("filters out slots that fall outside the hint window (dayOfWeek)", () => {
    // Hint: thursday only
    const mon = slot("2026-07-06T09:00:00.000Z", "2026-07-06T10:00:00.000Z");
    const thu = slot("2026-07-09T09:00:00.000Z", "2026-07-09T10:00:00.000Z");
    const fri = slot("2026-07-10T09:00:00.000Z", "2026-07-10T10:00:00.000Z");

    const scored = scoreSlots(
      [mon, thu, fri],
      planFocus,
      DEFAULT_PREFERENCES,
      { window: { dayOfWeek: "thu" } },
    );

    expect(scored).toHaveLength(1);
    expect(scored[0]!.start).toMatch(/^2026-07-09/);
  });

  it("uses the hint deadline when provided, overriding the plan deadline", () => {
    // Plan deadline: 2026-07-10. Hint deadline: 2026-07-12 (further away).
    // Slot on 2026-07-11 should be penalised less under the hint deadline.
    const slotJul11 = slot("2026-07-11T10:00:00.000Z", "2026-07-11T11:00:00.000Z");
    const planWithDeadline: ParsedPlan = { ...planFocus, deadline: "2026-07-10T17:00:00.000Z" };

    const withHint = scoreSlots(
      [slotJul11],
      planWithDeadline,
      DEFAULT_PREFERENCES,
      { deadline: "2026-07-12T17:00:00.000Z" },
    );
    const withoutHint = scoreSlots([slotJul11], planWithDeadline, DEFAULT_PREFERENCES);

    expect(withHint[0]!.score).toBeGreaterThan(withoutHint[0]!.score);
  });
});

describe("scoreSlots — output", () => {
  it("returns at most 3 suggestions, sorted by score descending", () => {
    const slots = [
      slot("2026-07-06T09:00:00.000Z", "2026-07-06T10:00:00.000Z"),
      slot("2026-07-07T10:00:00.000Z", "2026-07-07T11:00:00.000Z"),
      slot("2026-07-08T11:00:00.000Z", "2026-07-08T12:00:00.000Z"),
      slot("2026-07-09T12:00:00.000Z", "2026-07-09T13:00:00.000Z"),
      slot("2026-07-10T13:00:00.000Z", "2026-07-10T14:00:00.000Z"),
    ];

    const scored = scoreSlots(slots, planFocus, DEFAULT_PREFERENCES);
    expect(scored).toHaveLength(3);
    for (let i = 1; i < scored.length; i++) {
      expect(scored[i - 1]!.score).toBeGreaterThanOrEqual(scored[i]!.score);
    }
  });

  it("includes a human-readable Russian reason for each suggestion", () => {
    const s = slot("2026-07-08T09:00:00.000Z", "2026-07-08T10:00:00.000Z");
    const [scored] = scoreSlots([s], planFocus, DEFAULT_PREFERENCES);
    expect(scored!.reason).toMatch(/[а-яё]/i);
  });
});
