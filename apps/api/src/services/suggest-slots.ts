import type { ParsedPlan, Suggestion, Preferences } from "@calendar-planner/shared";
import { getFreeBusy, type GoogleCalendarClient } from "../infrastructure/google/freebusy.js";
import { currentWeek, parseWeekStart, weekOf, toIsoRange } from "../domain/week.js";
import { findSlots } from "../domain/slot-finder.js";
import { scoreSlots, mergeWithHint } from "../domain/scorer.js";
import { getLocalTimeZone } from "../domain/time-zone.js";
import type { PreferencesStore } from "../infrastructure/preferences/store.js";

export type CalendarClientFactory = (accessToken: string) => GoogleCalendarClient;
export type PlanParser = (text: string, timeZone: string) => Promise<ParsedPlan>;

export interface SuggestSlotsInput {
  text: string;
  startDate?: string; // YYYY-MM-DD in the target time zone
  timeZone?: string; // IANA time zone
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

  const timeZone = input.timeZone ?? getLocalTimeZone();

  let preferences = await preferencesStore.getPreferences();
  // The Owner's explicit preference overrides the device time zone.
  const effectiveTimeZone = preferences.timeZone || timeZone;

  const parsed = await parsePlan(input.text, effectiveTimeZone);
  preferences = mergeWithHint(preferences, parsed.hint);

  const startDate = input.startDate;
  const parsedStartDate = startDate ? parseWeekStart(startDate, effectiveTimeZone) : null;
  const week = parsedStartDate
    ? weekOf(parsedStartDate, effectiveTimeZone)
    : currentWeek(new Date(), effectiveTimeZone);

  const accessToken = await getAccessToken();
  let busy: Awaited<ReturnType<typeof getFreeBusy>> = {};
  if (accessToken) {
    const client = calendarClientFactory(accessToken);
    busy = await getFreeBusy(week, accessToken, client, effectiveTimeZone);
  }

  const window = {
    start: preferences.workingHoursStart,
    end: preferences.workingHoursEnd,
  };
  const weekStart = week.start;
  const slots = findSlots(busy, window, parsed.durationMinutes, preferences.bufferMinutes, weekStart, effectiveTimeZone);

  const scored = scoreSlots(slots, parsed, preferences, parsed.hint, effectiveTimeZone);

  return { parsed, suggestions: scored, preferences };
}

export { toIsoRange };
