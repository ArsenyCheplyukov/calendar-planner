import type { ParsedPlan, Suggestion, Preferences } from "@calendar-planner/shared";
import { getFreeBusy, type GoogleCalendarClient } from "../infrastructure/google/freebusy.js";
import { currentWeek, weekOf, toIsoRange } from "../domain/week.js";
import { findSlots } from "../domain/slot-finder.js";
import { scoreSlots, mergeWithHint, DEFAULT_PREFERENCES } from "../domain/scorer.js";

export type CalendarClientFactory = (accessToken: string) => GoogleCalendarClient;
export type PlanParser = (text: string) => Promise<ParsedPlan>;

export interface SuggestSlotsInput {
  text: string;
  preferences?: Preferences;
  startDate?: string; // YYYY-MM-DD
}

export interface SuggestSlotsDeps {
  parsePlan: PlanParser;
  calendarClientFactory: CalendarClientFactory;
  getAccessToken: () => Promise<string | null>;
}

export async function suggestSlots(
  input: SuggestSlotsInput,
  deps: SuggestSlotsDeps,
): Promise<{ parsed: ParsedPlan; suggestions: Suggestion[] }> {
  const { parsePlan, calendarClientFactory, getAccessToken } = deps;
  const preferences = input.preferences ?? DEFAULT_PREFERENCES;

  const parsed = await parsePlan(input.text);

  // Use the parsed deadline to anchor the week. If the user mentioned a date,
  // center the week around it. Otherwise default to the current planning week.
  const startDate = input.startDate;
  const week = startDate
    ? weekOf(new Date(startDate))
    : currentWeek();

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
  // Use Monday of the week as the start reference
  const weekStart = week.start;
  const slots = findSlots(busy, window, parsed.durationMinutes, preferences.bufferMinutes, weekStart);

  // Merge preferences with hint; Plan Hint already merged in scorer
  mergeWithHint(preferences, parsed.hint);
  const scored = scoreSlots(slots, parsed, preferences, parsed.hint);

  return { parsed, suggestions: scored };
}

// Re-export so route module has a single import
export { toIsoRange };
