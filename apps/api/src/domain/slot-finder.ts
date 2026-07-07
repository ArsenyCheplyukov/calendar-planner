import type { Slot, BusyMap, Preferences } from "@calendar-planner/shared";
import {
  getLocalTimeZone,
  ymdInTimeZone,
  setTimeOnDateInTimeZone,
  getParts,
  addDaysInTimeZone,
  getWeekday,
  timeOfDayMinutesInTimeZone,
  hasConflict,
} from "@calendar-planner/shared";

export interface WorkingWindow {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

const INCREMENT_MIN = 15;

const DAY_OF_WEEK_TO_INDEX: Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function minutesFromHHMM(s: string): number {
  const { h, m } = parseHHMM(s);
  return h * 60 + m;
}

function overlapsBlackout(
  start: Date,
  end: Date,
  blackouts: Preferences["blackouts"],
  timeZone: string,
): boolean {
  if (blackouts.length === 0) return false;
  const dayIndex = getWeekday(timeZone, start);
  const startMin = timeOfDayMinutesInTimeZone(timeZone, start);
  const endMin = timeOfDayMinutesInTimeZone(timeZone, end);

  for (const blackout of blackouts) {
    if (DAY_OF_WEEK_TO_INDEX[blackout.dayOfWeek] !== dayIndex) continue;
    const bStart = minutesFromHHMM(blackout.start);
    const bEnd = minutesFromHHMM(blackout.end);
    if (startMin < bEnd && endMin > bStart) {
      return true;
    }
  }
  return false;
}

/**
 * For each day in the Mon–Sun week containing `weekStart`, find the earliest
 * viable time slot of `durationMinutes` length inside `window`, honoring
 * `bufferMin` between the slot and any busy block. Returns at most one slot
 * per day (or none if no viable slot exists).
 *
 * All local-time computations use `timeZone`.
 */
export function findSlots(
  busy: BusyMap,
  window: WorkingWindow,
  durationMinutes: number,
  bufferMinutes: number,
  weekStart: Date,
  timeZone: string = getLocalTimeZone(),
  blackouts: Preferences["blackouts"] = [],
  eventBufferBeforeMinutes: number = 0,
  eventBufferAfterMinutes: number = 0,
): Slot[] {
  if (durationMinutes <= 0) return [];

  const { h: startH, m: startM } = parseHHMM(window.start);
  const { h: endH, m: endM } = parseHHMM(window.end);
  const slots: Slot[] = [];

  for (let d = 0; d < 7; d++) {
    const day = addDaysInTimeZone(timeZone, weekStart, d);

    const dayKey = ymdInTimeZone(timeZone, day);
    const dayBusy = busy[dayKey] ?? [];

    const dayStart = setTimeOnDateInTimeZone(timeZone, day, startH, startM);
    const dayEnd = setTimeOnDateInTimeZone(timeZone, day, endH, endM);
    const totalMs = dayEnd.getTime() - dayStart.getTime();
    const durationMs = durationMinutes * 60 * 1000;

    if (totalMs < durationMs) continue;

    const eventBufferBeforeMs = eventBufferBeforeMinutes * 60 * 1000;
    const eventBufferAfterMs = eventBufferAfterMinutes * 60 * 1000;

    // Enumerate 15-min increments
    let found: Slot | null = null;
    const increments = Math.floor(totalMs / (INCREMENT_MIN * 60 * 1000));
    for (let i = 0; i <= increments; i++) {
      const candidateStart = new Date(dayStart.getTime() + i * INCREMENT_MIN * 60 * 1000);
      const candidateEnd = new Date(candidateStart.getTime() + durationMs);

      // Skip if candidate end goes past dayEnd
      if (candidateEnd.getTime() > dayEnd.getTime()) break;

      const blockedStart = new Date(candidateStart.getTime() - eventBufferBeforeMs);
      const blockedEnd = new Date(candidateEnd.getTime() + eventBufferAfterMs);

      if (
        !hasConflict({ start: blockedStart, end: blockedEnd }, dayBusy, bufferMinutes) &&
        !overlapsBlackout(blockedStart, blockedEnd, blackouts, timeZone)
      ) {
        found = { start: candidateStart.toISOString(), end: candidateEnd.toISOString() };
        break;
      }
    }

    if (found) slots.push(found);
  }

  return slots;
}
