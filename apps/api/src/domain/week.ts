import type { PlanHint } from "@calendar-planner/shared";
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

const DAY_OF_WEEK_TO_INDEX: Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

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

/** The Mon–Sun week containing `now`, regardless of whether `now` is a weekend. */
export function currentWeek(
  now: Date = new Date(),
  timeZone: string = getLocalTimeZone(),
): Week {
  const monday = mondayOf(now, timeZone);
  const sunday = addDaysInTimeZone(timeZone, monday, 6);
  return { start: monday, end: endOfDayInTimeZone(timeZone, sunday) };
}

/**
 * Resolve a canonical anchor date from a plan hint and a reference date.
 *
 * - `hint.window.date` wins if present.
 * - `hint.window.dayOfWeek` resolves to the nearest future occurrence,
 *   including today if the reference date already matches.
 * - Otherwise the reference date itself is returned.
 *
 * The result is always a single deterministic date that drives week selection.
 */
export function resolveAnchorDate(
  hint: PlanHint | null | undefined,
  referenceDate: Date,
  timeZone: string,
): Date {
  if (hint?.window?.date) {
    const parsed = parseYmdInTimeZone(timeZone, hint.window.date);
    if (parsed) return parsed;
  }
  if (hint?.window?.dayOfWeek) {
    const targetDow = DAY_OF_WEEK_TO_INDEX[hint.window.dayOfWeek];
    const refDow = getWeekday(timeZone, referenceDate);
    const delta = (targetDow - refDow + 7) % 7;
    return addDaysInTimeZone(timeZone, referenceDate, delta);
  }
  return referenceDate;
}

export function previousWeek(
  week: Week,
  timeZone: string = getLocalTimeZone(),
): Week {
  return {
    start: addDaysInTimeZone(timeZone, week.start, -7),
    end: addDaysInTimeZone(timeZone, week.end, -7),
  };
}

export function nextWeek(
  week: Week,
  timeZone: string = getLocalTimeZone(),
): Week {
  return {
    start: addDaysInTimeZone(timeZone, week.start, 7),
    end: addDaysInTimeZone(timeZone, week.end, 7),
  };
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
