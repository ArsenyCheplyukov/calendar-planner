import {
  getLocalTimeZone,
  getParts,
  getWeekday,
  startOfDayInTimeZone,
  endOfDayInTimeZone,
  addDaysInTimeZone,
  formatRfc3339,
  parseYmdInTimeZone,
  dateFromParts,
} from "@calendar-planner/shared";

export interface Week {
  start: Date; // Monday 00:00:00.000 in the target time zone
  end: Date;   // Sunday 23:59:59.999 in the target time zone
}

export interface IsoRange {
  timeMin: string; // RFC3339 with the target time zone offset
  timeMax: string;
}

/** Monday on or before `now` in `timeZone`. */
function mondayOf(now: Date, timeZone: string): Date {
  const day = getWeekday(timeZone, now); // 0=Sun, 1=Mon, …, 6=Sat
  const offsetToMonday = day === 0 ? -6 : 1 - day; // Sun → -6, Mon → 0, Tue → -1, …, Sat → -5
  const parts = getParts(timeZone, now);
  return dateFromParts(timeZone, {
    year: parts.year,
    month: parts.month,
    day: parts.day + offsetToMonday,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
}

/** If today is Sat/Sun, jump to next Monday. Otherwise the current Mon–Sun. */
export function currentWeek(
  now: Date = new Date(),
  timeZone: string = getLocalTimeZone(),
): Week {
  const day = getWeekday(timeZone, now);
  const baseMonday = mondayOf(now, timeZone);
  if (day === 0 || day === 6) {
    baseMonday.setTime(
      addDaysInTimeZone(timeZone, baseMonday, 7).getTime(),
    );
  }
  const sunday = addDaysInTimeZone(timeZone, baseMonday, 6);
  return { start: baseMonday, end: endOfDayInTimeZone(timeZone, sunday) };
}

export function previousWeek(week: Week): Week {
  const start = new Date(week.start);
  const end = new Date(week.end);
  // Each Week stores Date objects whose wall-clock components are in the
  // target time zone; subtracting whole days works by raw milliseconds.
  start.setDate(week.start.getDate() - 7);
  end.setDate(week.end.getDate() - 7);
  return { start, end };
}

export function nextWeek(week: Week): Week {
  const start = new Date(week.start);
  const end = new Date(week.end);
  start.setDate(week.start.getDate() + 7);
  end.setDate(week.end.getDate() + 7);
  return { start, end };
}

/** Convert a Week to RFC3339 strings with the target time zone offset. */
export function toIsoRange(week: Week, timeZone: string = getLocalTimeZone()): IsoRange {
  return {
    timeMin: formatRfc3339(week.start, timeZone),
    timeMax: formatRfc3339(week.end, timeZone),
  };
}

/** Parse a YYYY-MM-DD string into a Date at midnight in `timeZone`. */
export function parseWeekStart(input: string, timeZone: string = getLocalTimeZone()): Date | null {
  return parseYmdInTimeZone(timeZone, input);
}

/** Build a Week from any date in the week (Mon 00:00 → Sun 23:59:59.999). */
export function weekOf(d: Date, timeZone: string = getLocalTimeZone()): Week {
  const monday = mondayOf(d, timeZone);
  const sunday = addDaysInTimeZone(timeZone, monday, 6);
  return { start: monday, end: endOfDayInTimeZone(timeZone, sunday) };
}
