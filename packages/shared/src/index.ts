// Domain types shared between @calendar-planner/api and @calendar-planner/web.
// These are deliberately minimal in slice 002 — full shapes land in later slices.

import { ymdInTimeZone } from "./time-zone.js";

export type EventType = "focus" | "meeting" | "personal" | "errand";

export type TimeOfDay = "morning" | "midday" | "evening";

export interface TimeWindow {
  dayOfWeek?: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  timeOfDay?: TimeOfDay;
  date?: string; // ISO date (YYYY-MM-DD)
  time?: string; // "HH:MM" — explicit start time
}

export interface PlanHint {
  window?: TimeWindow;
  deadline?: string; // ISO datetime
}

export interface ParsedPlan {
  title: string;
  durationMinutes: number;
  bufferBeforeMinutes?: number | null;
  bufferAfterMinutes?: number | null;
  type: EventType;
  deadline?: string | null;
  hint?: PlanHint | null;
}

export interface Slot {
  start: string; // ISO datetime
  end: string;   // ISO datetime
}

export interface ScoredSlot extends Slot {
  score: number;
}

export interface Suggestion extends ScoredSlot {
  reason: string;
}

export interface PlanCandidate {
  candidateId: string;
  rank: number;
  parsedPlan: ParsedPlan;
  suggestions: Suggestion[];
}

export interface BusyInterval {
  start: string; // ISO datetime
  end: string;   // ISO datetime
}

export type BusyMap = Record<string, BusyInterval[]>;

export function groupIntervalsByDay(
  intervals: BusyInterval[],
  timeZone: string,
): BusyMap {
  const out: BusyMap = {};
  for (const interval of intervals) {
    const dayKey = ymdInTimeZone(timeZone, new Date(interval.start));
    if (!out[dayKey]) out[dayKey] = [];
    out[dayKey].push(interval);
  }
  return out;
}

export function filterSuggestionsByWeek<T extends { start: string }>(
  suggestions: T[],
  weekStart: string,
  weekEnd: string,
): T[] {
  const ws = new Date(weekStart).getTime();
  const we = new Date(weekEnd).getTime();
  return suggestions.filter((s) => {
    const t = new Date(s.start).getTime();
    return t >= ws && t <= we;
  });
}

export function filterSuggestionsByDay<T extends { start: string }>(
  suggestions: T[],
  dayKey: string,
): T[] {
  return suggestions.filter((s) => s.start.slice(0, 10) === dayKey);
}

export interface Preferences {
  workingHoursStart: string; // "HH:MM"
  workingHoursEnd: string;   // "HH:MM"
  bufferMinutes: number;
  typeBiasFocus: string;     // "HH:MM-HH:MM" | "any"
  typeBiasMeeting: string;
  typeBiasPersonal: string;
  typeBiasErrand: string;
  blackouts: Array<{
    dayOfWeek: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
    start: string; // "HH:MM"
    end: string;   // "HH:MM"
  }>;
  timeZone: string; // IANA time zone, e.g. "Europe/Moscow"
}

export const DEFAULT_PREFERENCES: Preferences = {
  workingHoursStart: "09:00",
  workingHoursEnd: "19:00",
  bufferMinutes: 15,
  typeBiasFocus: "09:00-12:00",
  typeBiasMeeting: "11:00-16:00",
  typeBiasPersonal: "any",
  typeBiasErrand: "16:00-19:00",
  blackouts: [],
  timeZone: "UTC",
};

export * from "./time-zone.js";
