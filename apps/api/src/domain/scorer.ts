import type { ScoredSlot, Slot, ParsedPlan, Preferences, PlanHint, EventType, TimeOfDay } from "@calendar-planner/shared";

export const DEFAULT_PREFERENCES: Preferences = {
  workingHoursStart: "09:00",
  workingHoursEnd: "19:00",
  bufferMinutes: 15,
  typeBiasFocus: "09:00-12:00",
  typeBiasMeeting: "11:00-16:00",
  typeBiasPersonal: "any",
  typeBiasErrand: "16:00-19:00",
  blackouts: [],
};

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
  if (!hint?.window?.timeOfDay) return { ...preferences };
  const { start, end } = TIME_OF_DAY_WINDOWS[hint.window.timeOfDay];
  return { ...preferences, workingHoursStart: start, workingHoursEnd: end };
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

function timeOfDayMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function inRange(minutes: number, range: { startH: number; startM: number; endH: number; endM: number }): boolean {
  const start = range.startH * 60 + range.startM;
  const end = range.endH * 60 + range.endM;
  return minutes >= start && minutes < end;
}

function typeBiasBonus(slot: Slot, type: EventType, preferences: Preferences): number {
  const range = biasForType(type, preferences);
  if (!range) return 0.2; // "any" = neutral bonus
  const startMin = timeOfDayMinutes(new Date(slot.start));
  return inRange(startMin, range) ? 0.3 : 0;
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

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function reasonForSlot(slot: Slot, type: EventType, preferences: Preferences, hint: PlanHint | null | undefined): string {
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  const startDay = DAY_NAMES_RU[start.getDay()] ?? "";
  const endDay = DAY_NAMES_RU[end.getDay()] ?? "";
  const hh = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const typeName =
    type === "focus" ? "фокус-работа" :
    type === "meeting" ? "митинг" :
    type === "personal" ? "личное" :
    "поручение";

  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
  return `${startDay} ${hh(start)}–${hh(end)}, ${durationMin} мин (${typeName})`;
}

const DAY_NAMES_RU = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

function filterByHint(slots: Slot[], hint: PlanHint | null | undefined): Slot[] {
  if (!hint?.window) return slots;
  const win = hint.window;
  return slots.filter((s) => {
    const start = new Date(s.start);
    if (win.dayOfWeek) {
      const dow = start.getDay();
      const expected = DAY_OF_WEEK_TO_INDEX[win.dayOfWeek];
      if (dow !== expected) return false;
    }
    if (win.timeOfDay) {
      const minutes = timeOfDayMinutes(start);
      const { start: startStr, end: endStr } = TIME_OF_DAY_WINDOWS[win.timeOfDay]!;
      const [startH, startM] = startStr.split(":").map(Number);
      const [endH, endM] = endStr.split(":").map(Number);
      const range = { startH: startH!, startM: startM!, endH: endH!, endM: endM! };
      if (!inRange(minutes, range)) return false;
    }
    if (win.date) {
      if (ymdLocal(start) !== win.date) return false;
    }
    return true;
  });
}

export function scoreSlots(
  slots: Slot[],
  plan: ParsedPlan,
  preferences: Preferences,
  hint?: PlanHint | null,
): ScoredSlot[] {
  const effectiveHint = hint ?? plan.hint ?? null;
  const effectiveDeadline = effectiveHint?.deadline ?? plan.deadline ?? null;

  const filtered = filterByHint(slots, effectiveHint);
  if (filtered.length === 0) return [];

  const scored: ScoredSlot[] = filtered.map((slot) => {
    const typeBonus = typeBiasBonus(slot, plan.type, preferences);
    const dlPenalty = deadlinePenalty(slot, effectiveDeadline);
    const base = 0.5;
    const score = Math.max(0, Math.min(1, base + typeBonus + dlPenalty));
    return {
      ...slot,
      score,
      reason: reasonForSlot(slot, plan.type, preferences, effectiveHint),
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3);
}
