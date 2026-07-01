import { useMemo } from "react";
import { Button } from "../Button/index.js";
import styles from "./WeekView.module.css";

export interface WeekViewWeek {
  start: string; // ISO datetime
  end: string;   // ISO datetime
}

export type WeekViewBusyMap = Record<string, Array<{ start: string; end: string }>>;

export interface WeekViewSuggestion {
  start: string;
  end: string;
  score?: number;
  reason?: string;
}

export interface WeekViewProps {
  week: WeekViewWeek;
  busy: WeekViewBusyMap;
  suggestions?: WeekViewSuggestion[];
  today?: string; // YYYY-MM-DD; defaults to "now" in local time
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onBlockClick?: (busySlot: { start: string; end: string }) => void;
  onSuggestionClick?: (suggestion: WeekViewSuggestion) => void;
}

const DAY_NAMES_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_NAMES_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatRangeLabel(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const startDay = s.getDate();
  const endDay = e.getDate();
  const startMonth = MONTH_NAMES_RU[s.getMonth()];
  const endMonth = MONTH_NAMES_RU[e.getMonth()];
  if (s.getMonth() === e.getMonth()) {
    return `${startDay} – ${endDay} ${startMonth}`;
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
}

export function WeekView({
  week,
  busy,
  suggestions = [] as WeekViewSuggestion[],
  today,
  onPrev,
  onNext,
  onToday,
  onBlockClick,
  onSuggestionClick,
}: WeekViewProps) {
  const days = useMemo(() => {
    const out: Date[] = [];
    const start = new Date(week.start);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, [week.start]);

  const todayKey = today ?? ymdLocal(new Date());

  return (
    <div className={styles["week"]} data-testid="week-view">
      <div className={styles["header"]}>
        <h2 className={styles["title"]}>
          {formatRangeLabel(week.start, week.end)}
        </h2>
        <div className={styles["nav"]}>
          <Button variant="ghost" size="sm" onClick={onPrev} aria-label="Предыдущая неделя">
            ←
          </Button>
          <Button variant="secondary" size="sm" onClick={onToday}>
            Сегодня
          </Button>
          <Button variant="ghost" size="sm" onClick={onNext} aria-label="Следующая неделя">
            →
          </Button>
        </div>
      </div>

      <div className={styles["grid"]} data-testid="week-grid">
        {days.map((d, i) => {
          const key = ymdLocal(d);
          const dayBusy = busy[key] ?? [];
          const daySuggestions: WeekViewSuggestion[] = suggestions.filter(
            (s: WeekViewSuggestion) => s.start.slice(0, 10) === key,
          );
          const isPast = key < todayKey;
          return (
            <div
              key={key}
              className={styles["day"]}
              data-testid="day-column"
              data-day={key}
              data-past={isPast ? "true" : "false"}
            >
              <div className={styles["day-header"]}>
                <span className={styles["day-name"]}>{DAY_NAMES_RU[i]}</span>
                <span className={styles["day-date"]}>{d.getDate()}</span>
              </div>
              <div className={styles["day-body"]}>
                {dayBusy.length === 0 && daySuggestions.length === 0 ? (
                  <span className={styles["empty"]}>—</span>
                ) : (
                  <>
                    {dayBusy.map((slot, idx) => (
                      <button
                        key={`busy-${slot.start}-${idx}`}
                        type="button"
                        className={styles["busy-block"]}
                        data-testid="busy-block"
                        onClick={() => onBlockClick?.(slot)}
                      >
                        {timeLabel(slot.start)}–{timeLabel(slot.end)}
                      </button>
                    ))}
                    {daySuggestions.map((s, idx) => (
                      <button
                        key={`sug-${s.start}-${idx}`}
                        type="button"
                        className={styles["suggested-block"]}
                        data-testid="suggested-block"
                        onClick={() => onSuggestionClick?.(s)}
                      >
                        {timeLabel(s.start)}–{timeLabel(s.end)}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
