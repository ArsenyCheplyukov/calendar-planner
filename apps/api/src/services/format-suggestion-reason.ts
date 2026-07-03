import type { ScoredSlot, EventType } from "@calendar-planner/shared";
import { getParts, getWeekday } from "@calendar-planner/shared";

const DAY_NAMES_RU = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

const TYPE_NAMES_RU: Record<EventType, string> = {
  focus: "фокус-работа",
  meeting: "митинг",
  personal: "личное",
  errand: "поручение",
};

export function formatSuggestionReason(
  slot: ScoredSlot,
  type: EventType,
  timeZone: string,
): string {
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  const startParts = getParts(timeZone, start);
  const endParts = getParts(timeZone, end);
  const startDayIndex = getWeekday(timeZone, start);
  const startDay = DAY_NAMES_RU[startDayIndex] ?? "";

  const hh = (parts: ReturnType<typeof getParts>) =>
    `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;

  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
  return `${startDay} ${hh(startParts)}–${hh(endParts)}, ${durationMin} мин (${TYPE_NAMES_RU[type]})`;
}
