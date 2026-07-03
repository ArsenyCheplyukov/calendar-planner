import type { ParsedPlan, Suggestion, Preferences } from "@calendar-planner/shared";
import { getFreeBusy, type GoogleCalendarClient } from "../infrastructure/google/freebusy.js";
import { currentWeek, parseWeekStart, weekOf, toIsoRange, type Week } from "../domain/week.js";
import { findSlots } from "../domain/slot-finder.js";
import { scoreSlots, mergeWithHint } from "../domain/scorer.js";
import { getLocalTimeZone } from "@calendar-planner/shared";
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

export interface SuggestSlotsContext {
  preferences: Preferences;
  effectiveTimeZone: string;
  week: Week;
  busy: Awaited<ReturnType<typeof getFreeBusy>>;
}

export async function buildSuggestSlotsContext(
  input: SuggestSlotsInput,
  deps: Pick<SuggestSlotsDeps, "calendarClientFactory" | "getAccessToken" | "preferencesStore">,
): Promise<SuggestSlotsContext> {
  const { calendarClientFactory, getAccessToken, preferencesStore } = deps;

  const timeZone = input.timeZone ?? getLocalTimeZone();
  let preferences = await preferencesStore.getPreferences();
  const effectiveTimeZone = preferences.timeZone || timeZone;

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

  return { preferences, effectiveTimeZone, week, busy };
}

export function scorePlan(
  parsed: ParsedPlan,
  context: SuggestSlotsContext,
): Suggestion[] {
  const { preferences, effectiveTimeZone, week, busy } = context;
  const preferencesWithHint = mergeWithHint(preferences, parsed.hint);

  const window = {
    start: preferencesWithHint.workingHoursStart,
    end: preferencesWithHint.workingHoursEnd,
  };
  const slots = findSlots(
    busy,
    window,
    parsed.durationMinutes,
    preferencesWithHint.bufferMinutes,
    week.start,
    effectiveTimeZone,
  );

  return scoreSlots(slots, parsed, preferencesWithHint, parsed.hint, effectiveTimeZone);
}

export async function suggestSlots(
  input: SuggestSlotsInput,
  deps: SuggestSlotsDeps,
): Promise<{ parsed: ParsedPlan; suggestions: Suggestion[]; preferences: Preferences }> {
  const { parsePlan } = deps;

  const context = await buildSuggestSlotsContext(input, deps);
  const parsed = await parsePlan(input.text, context.effectiveTimeZone);
  const scored = scorePlan(parsed, context);

  return { parsed, suggestions: scored, preferences: context.preferences };
}

export { toIsoRange };
