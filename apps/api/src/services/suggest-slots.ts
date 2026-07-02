import type { ParsedPlan, Suggestion, Preferences } from "@calendar-planner/shared";
import { getFreeBusy, type GoogleCalendarClient } from "../infrastructure/google/freebusy.js";
import { currentWeek, weekOf, toIsoRange } from "../domain/week.js";
import { findSlots } from "../domain/slot-finder.js";
import { scoreSlots, mergeWithHint } from "../domain/scorer.js";
import type { PreferencesStore } from "../infrastructure/preferences/store.js";

export type CalendarClientFactory = (accessToken: string) => GoogleCalendarClient;
export type PlanParser = (text: string) => Promise<ParsedPlan>;

export interface SuggestSlotsInput {
  text: string;
  startDate?: string; // YYYY-MM-DD
}

export interface SuggestSlotsDeps {
  parsePlan: PlanParser;
  calendarClientFactory: CalendarClientFactory;
  getAccessToken: () => Promise<string | null>;
  preferencesStore: PreferencesStore;
}

export async function suggestSlots(
  input: SuggestSlotsInput,
  deps: SuggestSlotsDeps,
): Promise<{ parsed: ParsedPlan; suggestions: Suggestion[]; preferences: Preferences }> {
  const { parsePlan, calendarClientFactory, getAccessToken, preferencesStore } = deps;

  let preferences = await preferencesStore.getPreferences();
  const parsed = await parsePlan(input.text);
  preferences = mergeWithHint(preferences, parsed.hint);

  const startDate = input.startDate;
  const week = startDate ? weekOf(new Date(startDate)) : currentWeek();

  const accessToken = await getAccessToken();
  let busy: Awaited<ReturnType<typeof getFreeBusy>> = {};
  if (accessToken) {
    const client = calendarClientFactory(accessToken);
    busy = await getFreeBusy(week, accessToken, client);
  }

  const window = {
    start: preferences.workingHoursStart,
    end: preferences.workingHoursEnd,
  };
  const weekStart = week.start;
  const slots = findSlots(busy, window, parsed.durationMinutes, preferences.bufferMinutes, weekStart);

  const scored = scoreSlots(slots, parsed, preferences, parsed.hint);

  return { parsed, suggestions: scored, preferences };
}

export { toIsoRange };
