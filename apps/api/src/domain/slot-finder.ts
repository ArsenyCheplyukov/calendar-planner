import type { Slot, BusyMap } from "@calendar-planner/shared";
import {
  getLocalTimeZone,
  ymdInTimeZone,
  setTimeOnDateInTimeZone,
  getParts,
  addDaysInTimeZone,
} from "@calendar-planner/shared";

export interface WorkingWindow {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

const INCREMENT_MIN = 15;

function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function overlapsWithBuffer(
  start: Date,
  end: Date,
  busy: Array<{ start: string; end: string }>,
  bufferMin: number,
): boolean {
  const bufferMs = bufferMin * 60 * 1000;
  for (const b of busy) {
    const bStart = new Date(b.start).getTime() - bufferMs;
    const bEnd = new Date(b.end).getTime() + bufferMs;
    if (start.getTime() < bEnd && end.getTime() > bStart) {
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

    // Enumerate 15-min increments
    let found: Slot | null = null;
    const increments = Math.floor(totalMs / (INCREMENT_MIN * 60 * 1000));
    for (let i = 0; i <= increments; i++) {
      const candidateStart = new Date(dayStart.getTime() + i * INCREMENT_MIN * 60 * 1000);
      const candidateEnd = new Date(candidateStart.getTime() + durationMs);

      // Skip if candidate end goes past dayEnd
      if (candidateEnd.getTime() > dayEnd.getTime()) break;

      if (!overlapsWithBuffer(candidateStart, candidateEnd, dayBusy, bufferMinutes)) {
        found = { start: candidateStart.toISOString(), end: candidateEnd.toISOString() };
        break;
      }
    }

    if (found) slots.push(found);
  }

  return slots;
}
