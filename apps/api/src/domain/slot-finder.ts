import type { Slot } from "@calendar-planner/shared";
import type { BusyMap } from "../infrastructure/google/freebusy.js";

export interface WorkingWindow {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

const INCREMENT_MIN = 15;

function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function setTimeOnDate(d: Date, h: number, m: number): Date {
  const out = new Date(d);
  out.setHours(h, m, 0, 0);
  return out;
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
 */
export function findSlots(
  busy: BusyMap,
  window: WorkingWindow,
  durationMinutes: number,
  bufferMinutes: number,
  weekStart: Date,
): Slot[] {
  if (durationMinutes <= 0) return [];

  const { h: startH, m: startM } = parseHHMM(window.start);
  const { h: endH, m: endM } = parseHHMM(window.end);
  const slots: Slot[] = [];

  for (let d = 0; d < 7; d++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + d);

    const dayKey = ymdLocal(day);
    const dayBusy = busy[dayKey] ?? [];

    const dayStart = setTimeOnDate(day, startH, startM);
    const dayEnd = setTimeOnDate(day, endH, endM);
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
