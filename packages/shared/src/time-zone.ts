/** Time-zone-aware date helpers.
 *
 * The app treats the Owner's device time zone as the source of truth for
 * parsing plans, drawing the week grid, and placing events. These helpers
 * let the backend compute in any IANA zone without pulling in a date
 * library.
 */

export interface DateParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function getLocalTimeZone(): string {
  return LOCAL_TIME_ZONE;
}

const fullFormatCache = new Map<string, Intl.DateTimeFormat>();
const weekdayFormatCache = new Map<string, Intl.DateTimeFormat>();

function getFullFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = fullFormatCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });
    fullFormatCache.set(timeZone, fmt);
  }
  return fmt;
}

function getWeekdayFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = weekdayFormatCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    });
    weekdayFormatCache.set(timeZone, fmt);
  }
  return fmt;
}

function partValue(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((p) => p.type === type)?.value ?? "0";
}

export function getParts(timeZone: string, date: Date): DateParts {
  const parts = getFullFormatter(timeZone).formatToParts(date);
  return {
    year: Number(partValue(parts, "year")),
    month: Number(partValue(parts, "month")),
    day: Number(partValue(parts, "day")),
    hour: Number(partValue(parts, "hour")),
    minute: Number(partValue(parts, "minute")),
    second: Number(partValue(parts, "second")),
    millisecond: date.getMilliseconds(),
  };
}

/** Convert wall-clock parts in `timeZone` to a real UTC timestamp Date. */
export function dateFromParts(
  timeZone: string,
  parts: Omit<DateParts, "millisecond"> & { millisecond?: number },
): Date {
  const ms = parts.millisecond ?? 0;
  const targetUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    ms,
  );

  let guess = targetUtc;
  for (let i = 0; i < 6; i++) {
    const formatted = getParts(timeZone, new Date(guess));
    const offset =
      Date.UTC(
        formatted.year,
        formatted.month - 1,
        formatted.day,
        formatted.hour,
        formatted.minute,
        formatted.second,
        formatted.millisecond,
      ) - guess;
    const next = targetUtc - offset;
    if (next === guess) break;
    guess = next;
  }

  return new Date(guess);
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function getWeekday(timeZone: string, date: Date): number {
  const name = getWeekdayFormatter(timeZone).format(date);
  return WEEKDAY_INDEX[name] ?? date.getDay();
}

export function startOfDayInTimeZone(
  timeZone: string,
  date: Date,
): Date {
  const parts = getParts(timeZone, date);
  return dateFromParts(timeZone, {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
}

export function endOfDayInTimeZone(
  timeZone: string,
  date: Date,
): Date {
  const parts = getParts(timeZone, date);
  return dateFromParts(timeZone, {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 23,
    minute: 59,
    second: 59,
    millisecond: 999,
  });
}

export function addDaysInTimeZone(
  timeZone: string,
  date: Date,
  days: number,
): Date {
  const parts = getParts(timeZone, date);
  return dateFromParts(timeZone, {
    year: parts.year,
    month: parts.month,
    day: parts.day + days,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    millisecond: parts.millisecond,
  });
}

export function ymdInTimeZone(timeZone: string, date: Date): string {
  const parts = getParts(timeZone, date);
  const y = String(parts.year);
  const m = String(parts.month).padStart(2, "0");
  const d = String(parts.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function timeOfDayMinutesInTimeZone(
  timeZone: string,
  date: Date,
): number {
  const parts = getParts(timeZone, date);
  return parts.hour * 60 + parts.minute;
}

export function formatRfc3339(date: Date, timeZone: string): string {
  const parts = getParts(timeZone, date);
  const asUtcWall = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0,
  );
  const offsetMin = Math.round((asUtcWall - date.getTime()) / 60000);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const off = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;

  const ms = parts.millisecond;
  const msPart = ms > 0 ? `.${String(ms).padStart(3, "0")}` : "";
  return (
    `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}` +
    `T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}` +
    `${msPart}${off}`
  );
}

export function parseYmdInTimeZone(
  timeZone: string,
  input: string,
): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!m) return null;
  const [, y, mo, d] = m;
  return dateFromParts(timeZone, {
    year: Number(y),
    month: Number(mo),
    day: Number(d),
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
}

export function setTimeOnDateInTimeZone(
  timeZone: string,
  date: Date,
  h: number,
  m: number,
): Date {
  const parts = getParts(timeZone, date);
  return dateFromParts(timeZone, {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: h,
    minute: m,
    second: 0,
    millisecond: 0,
  });
}
