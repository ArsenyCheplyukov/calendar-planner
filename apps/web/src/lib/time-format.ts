import {
  getLocalTimeZone,
  getParts,
  getWeekday,
  ymdInTimeZone,
  addDaysInTimeZone,
} from "@calendar-planner/shared";

const MONTH_NAMES_RU = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const WEEKDAY_SHORT_RU = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

const WEEKDAY_LONG_RU = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
];

export function formatDayOfMonth(
  date: Date,
  timeZone: string = getLocalTimeZone(),
): number {
  return getParts(timeZone, date).day;
}

export function formatTime(
  iso: string,
  timeZone: string = getLocalTimeZone(),
): string {
  const parts = getParts(timeZone, new Date(iso));
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function formatYmd(
  date: Date,
  timeZone: string = getLocalTimeZone(),
): string {
  return ymdInTimeZone(timeZone, date);
}

export function formatDayName(
  iso: string,
  timeZone: string = getLocalTimeZone(),
): string {
  return WEEKDAY_SHORT_RU[getWeekday(timeZone, new Date(iso))] ?? "";
}

export function formatDateLong(
  iso: string,
  timeZone: string = getLocalTimeZone(),
): string {
  const parts = getParts(timeZone, new Date(iso));
  const weekday = WEEKDAY_LONG_RU[getWeekday(timeZone, new Date(iso))] ?? "";
  return `${weekday}, ${parts.day} ${MONTH_NAMES_RU[parts.month - 1]}`;
}

export function formatWeekRange(
  startIso: string,
  endIso: string,
  timeZone: string = getLocalTimeZone(),
): string {
  const startParts = getParts(timeZone, new Date(startIso));
  const endParts = getParts(timeZone, new Date(endIso));

  if (startParts.month === endParts.month) {
    return `${startParts.day} – ${endParts.day} ${MONTH_NAMES_RU[startParts.month - 1]}`;
  }
  return `${startParts.day} ${MONTH_NAMES_RU[startParts.month - 1]} – ${endParts.day} ${MONTH_NAMES_RU[endParts.month - 1]}`;
}

export function addDays(
  iso: string,
  days: number,
  timeZone: string = getLocalTimeZone(),
): Date {
  return addDaysInTimeZone(timeZone, new Date(iso), days);
}
