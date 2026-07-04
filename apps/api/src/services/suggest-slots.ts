import type { ParsedPlan, Suggestion, ScoredSlot, Preferences, PlanCandidate, EventType } from "@calendar-planner/shared";
import { getFreeBusy, type GoogleCalendarClient } from "../infrastructure/google/freebusy.js";
import { currentWeek, parseWeekStart, weekOf, toIsoRange, type Week } from "../domain/week.js";
import { findSlots } from "../domain/slot-finder.js";
import { scoreSlots, mergeWithHint } from "../domain/scorer.js";
import { formatSuggestionReason } from "./format-suggestion-reason.js";
import { getLocalTimeZone } from "@calendar-planner/shared";
import type { PreferencesStore } from "../infrastructure/preferences/store.js";

export type CalendarClientFactory = (accessToken: string) => GoogleCalendarClient;
export type PlanCandidatesParser = (text: string, timeZone: string) => Promise<ParsedPlan[]>;

export interface SuggestSlotsInput {
  text: string;
  startDate?: string; // YYYY-MM-DD in the target time zone
  timeZone?: string; // IANA time zone
}

export interface SuggestSlotsContext {
  preferences: Preferences;
  effectiveTimeZone: string;
  week: Week;
  busy: Awaited<ReturnType<typeof getFreeBusy>>;
}

export async function buildSuggestSlotsContext(
  input: SuggestSlotsInput,
  deps: Pick<SuggestSlotCandidatesDeps, "calendarClientFactory" | "getAccessToken" | "preferencesStore">,
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

function toSuggestions(
  scored: ScoredSlot[],
  type: EventType,
  timeZone: string,
): Suggestion[] {
  return scored.map((slot) => ({
    ...slot,
    reason: formatSuggestionReason(slot, type, timeZone),
  }));
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
    preferencesWithHint.blackouts,
  );

  const scored = scoreSlots(slots, parsed, preferencesWithHint, parsed.hint, effectiveTimeZone);
  return toSuggestions(scored, parsed.type, effectiveTimeZone);
}

export interface SuggestSlotCandidatesDeps {
  parsePlanCandidates: PlanCandidatesParser;
  calendarClientFactory: CalendarClientFactory;
  getAccessToken: () => Promise<string | null>;
  preferencesStore: PreferencesStore;
}

export async function suggestSlotCandidates(
  input: SuggestSlotsInput,
  deps: SuggestSlotCandidatesDeps,
): Promise<{ candidates: PlanCandidate[]; selectedCandidateId: string; parsed: ParsedPlan; suggestions: Suggestion[] }> {
  const { parsePlanCandidates } = deps;

  const context = await buildSuggestSlotsContext(input, deps);
  const parsedPlans = await parsePlanCandidates(input.text, context.effectiveTimeZone);

  const candidates: PlanCandidate[] = parsedPlans.map((parsedPlan, index) => ({
    candidateId: `candidate-${index + 1}`,
    rank: index + 1,
    parsedPlan,
    suggestions: scorePlan(parsedPlan, context),
  }));

  const selectedCandidate = candidates[0];
  if (!selectedCandidate) {
    throw new Error("Plan parser returned no valid candidates");
  }

  return {
    candidates,
    selectedCandidateId: selectedCandidate.candidateId,
    parsed: selectedCandidate.parsedPlan,
    suggestions: selectedCandidate.suggestions,
  };
}

export { toIsoRange };
