import type { ScoredSlot, Slot, ParsedPlan, Preferences, PlanHint, TimeOfDay, EventType } from "@calendar-planner/shared";
import {
  DEFAULT_PREFERENCES,
  getLocalTimeZone,
  getWeekday,
  parseYmdInTimeZone,
  timeOfDayMinutesInTimeZone,
  ymdInTimeZone,
} from "@calendar-planner/shared";

const DAY_OF_WEEK_TO_INDEX: Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const TIME_OF_DAY_WINDOWS: Record<TimeOfDay, { start: string; end: string }> = {
  morning: { start: "07:00", end: "12:00" },
  midday: { start: "12:00", end: "16:00" },
  evening: { start: "18:00", end: "23:00" },
};

export function mergeWithHint(
  preferences: Preferences,
  hint: PlanHint | null | undefined,
): Preferences {
  if (!hint?.window) return { ...preferences };
  if (hint.window.time) {
    return { ...preferences, workingHoursStart: hint.window.time, workingHoursEnd: "23:59" };
  }
  if (hint.window.timeOfDay) {
    const { start, end } = TIME_OF_DAY_WINDOWS[hint.window.timeOfDay];
    return { ...preferences, workingHoursStart: start, workingHoursEnd: end };
  }
  return { ...preferences };
}

function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function parseRange(s: string): { startH: number; startM: number; endH: number; endM: number } | null {
  if (s === "any") return null;
  const m = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return {
    startH: Number(m[1]),
    startM: Number(m[2]),
    endH: Number(m[3]),
    endM: Number(m[4]),
  };
}

function biasForType(type: EventType, preferences: Preferences): { startH: number; startM: number; endH: number; endM: number } | null {
  const raw =
    type === "focus" ? preferences.typeBiasFocus :
    type === "meeting" ? preferences.typeBiasMeeting :
    type === "personal" ? preferences.typeBiasPersonal :
    preferences.typeBiasErrand;
  return parseRange(raw);
}

function inRange(minutes: number, range: { startH: number; startM: number; endH: number; endM: number }): boolean {
  const start = range.startH * 60 + range.startM;
  const end = range.endH * 60 + range.endM;
  return minutes >= start && minutes < end;
}

function typeBiasBonus(slot: Slot, type: EventType, preferences: Preferences, timeZone: string): number {
  const range = biasForType(type, preferences);
  if (!range) return 0.2; // "any" = neutral bonus
  const startMin = timeOfDayMinutesInTimeZone(timeZone, new Date(slot.start));
  return inRange(startMin, range) ? 0.3 : 0;
}

function timeHintBonus(slot: Slot, hint: PlanHint | null | undefined, timeZone: string): number {
  if (!hint?.window?.time) return 0;
  const [hintH, hintM] = hint.window.time.split(":").map(Number);
  const hintMinutes = (hintH ?? 0) * 60 + (hintM ?? 0);
  const slotMinutes = timeOfDayMinutesInTimeZone(timeZone, new Date(slot.start));
  return slotMinutes === hintMinutes ? 0.35 : 0;
}

function weekendPenalty(slot: Slot, timeZone: string): number {
  const dow = getWeekday(timeZone, new Date(slot.start));
  return dow === 0 || dow === 6 ? -0.1 : 0;
}

function hintTargetsWeekend(hint: PlanHint | null | undefined, timeZone: string): boolean {
  if (!hint?.window) return false;
  if (hint.window.dayOfWeek === "sat" || hint.window.dayOfWeek === "sun") return true;
  if (hint.window.date) {
    const date = parseYmdInTimeZone(timeZone, hint.window.date);
    if (!date) return false;
    const dow = getWeekday(timeZone, date);
    return dow === 0 || dow === 6;
  }
  return false;
}

function deadlinePenalty(slot: Slot, deadline: string | null | undefined): number {
  if (!deadline) return 0;
  const slotEnd = new Date(slot.end).getTime();
  const deadlineMs = new Date(deadline).getTime();
  const diffMs = deadlineMs - slotEnd;
  const oneDay = 24 * 60 * 60 * 1000;
  if (diffMs < 0) return -0.6; // slot ends after deadline
  if (diffMs < oneDay) return -0.3; // ends within 24h of deadline
  if (diffMs < 2 * oneDay) return -0.1;
  return 0;
}

function filterByHint(slots: Slot[], hint: PlanHint | null | undefined, timeZone: string): Slot[] {
  if (!hint?.window) return slots;
  const win = hint.window;
  return slots.filter((s) => {
    const start = new Date(s.start);
    if (win.dayOfWeek) {
      const dow = getWeekday(timeZone, start);
      const expected = DAY_OF_WEEK_TO_INDEX[win.dayOfWeek];
      if (dow !== expected) return false;
    }
    if (win.timeOfDay) {
      const minutes = timeOfDayMinutesInTimeZone(timeZone, start);
      const { start: startStr, end: endStr } = TIME_OF_DAY_WINDOWS[win.timeOfDay]!;
      const [startH, startM] = startStr.split(":").map(Number);
      const [endH, endM] = endStr.split(":").map(Number);
      const range = { startH: startH!, startM: startM!, endH: endH!, endM: endM! };
      if (!inRange(minutes, range)) return false;
    }
    if (win.date) {
      if (ymdInTimeZone(timeZone, start) !== win.date) return false;
    }
    return true;
  });
}

export function scoreSlots(
  slots: Slot[],
  plan: ParsedPlan,
  preferences: Preferences,
  hint?: PlanHint | null,
  timeZone: string = getLocalTimeZone(),
): ScoredSlot[] {
  const effectiveHint = hint ?? plan.hint ?? null;
  const effectiveDeadline = effectiveHint?.deadline ?? plan.deadline ?? null;

  const filtered = filterByHint(slots, effectiveHint, timeZone);
  if (filtered.length === 0) return [];

  const skipWeekendPenalty = hintTargetsWeekend(effectiveHint, timeZone);

  const scored: ScoredSlot[] = filtered.map((slot) => {
    const typeBonus = typeBiasBonus(slot, plan.type, preferences, timeZone);
    const tBonus = timeHintBonus(slot, effectiveHint, timeZone);
    const dlPenalty = deadlinePenalty(slot, effectiveDeadline);
    const wePenalty = skipWeekendPenalty ? 0 : weekendPenalty(slot, timeZone);
    const base = 0.5;
    const score = Math.max(0, Math.min(1, base + typeBonus + tBonus + dlPenalty + wePenalty));
    return {
      ...slot,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}
