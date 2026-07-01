export interface Week {
  start: Date; // local Monday 00:00:00.000
  end: Date;   // local Sunday 23:59:59.999
}

export interface IsoRange {
  timeMin: string; // RFC3339 with offset
  timeMax: string;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Local-time Monday on or before `now`. */
function mondayOf(now: Date): Date {
  const day = now.getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const offsetToMonday = day === 0 ? -6 : 1 - day; // Sun → -6, Mon → 0, Tue → -1, …, Sat → -5
  const monday = new Date(now);
  monday.setDate(now.getDate() + offsetToMonday);
  return startOfLocalDay(monday);
}

/** If today is Sat/Sun, jump to next Monday. Otherwise the current Mon–Sun. */
export function currentWeek(now: Date = new Date()): Week {
  const day = now.getDay();
  const baseMonday = mondayOf(now);
  if (day === 0 || day === 6) {
    baseMonday.setDate(baseMonday.getDate() + 7);
  }
  const sunday = new Date(baseMonday);
  sunday.setDate(baseMonday.getDate() + 6);
  return { start: baseMonday, end: endOfLocalDay(sunday) };
}

export function previousWeek(week: Week): Week {
  const start = new Date(week.start);
  start.setDate(week.start.getDate() - 7);
  const end = new Date(week.end);
  end.setDate(week.end.getDate() - 7);
  return { start, end };
}

export function nextWeek(week: Week): Week {
  const start = new Date(week.start);
  start.setDate(week.start.getDate() + 7);
  const end = new Date(week.end);
  end.setDate(week.end.getDate() + 7);
  return { start, end };
}

/** Convert a Week to RFC3339 strings (with local TZ offset, not Z). */
export function toIsoRange(week: Week): IsoRange {
  return {
    timeMin: formatRfc3339(week.start),
    timeMax: formatRfc3339(week.end),
  };
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

function formatRfc3339(d: Date): string {
  const offsetMin = -d.getTimezoneOffset(); // minutes east of UTC
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const off = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  const ms = d.getMilliseconds();
  const msPart = ms > 0 ? `.${pad(ms, 3)}` : "";
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${msPart}${off}`
  );
}

/** Parse a YYYY-MM-DD string into a Date at local midnight. Returns null on bad input. */
export function parseWeekStart(input: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), 0, 0, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** Build a Week from any date in the week (Mon 00:00 → Sun 23:59:59.999). */
export function weekOf(d: Date): Week {
  const monday = mondayOf(d);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: endOfLocalDay(sunday) };
}
