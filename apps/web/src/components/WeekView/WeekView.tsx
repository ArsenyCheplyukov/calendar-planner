import { useMemo } from "react";
import type { BusyMap } from "@calendar-planner/shared";
import { filterSuggestionsByDay, getLocalTimeZone } from "@calendar-planner/shared";
import { Button } from "../Button/index.js";
import {
  formatTime,
  formatYmd,
  formatDayOfMonth,
  formatWeekRange,
  addDays,
} from "../../lib/time-format.js";
import styles from "./WeekView.module.css";

export interface WeekViewWeek {
  start: string; // ISO datetime
  end: string;   // ISO datetime
}

export type WeekViewBusyMap = BusyMap;

export interface WeekViewSuggestion {
  start: string;
  end: string;
  score?: number;
  reason?: string;
}

export interface WeekViewProps {
  week: WeekViewWeek;
  busy: BusyMap;
  suggestions?: WeekViewSuggestion[];
  today?: string; // YYYY-MM-DD; defaults to "now" in local time
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onBlockClick?: (busySlot: { start: string; end: string }) => void;
  onSuggestionClick?: (suggestion: WeekViewSuggestion) => void;
}

const DAY_NAMES_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

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
  const timeZone = getLocalTimeZone();

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 7; i++) {
      out.push(addDays(week.start, i, timeZone));
    }
    return out;
  }, [week.start, timeZone]);

  const todayKey = today ?? formatYmd(new Date(), timeZone);

  return (
    <div className={styles["week"]} data-testid="week-view">
      <div className={styles["header"]}>
        <h2 className={styles["title"]}>
          {formatWeekRange(week.start, week.end, timeZone)}
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
          const key = formatYmd(d, timeZone);
          const dayBusy = busy[key] ?? [];
          const daySuggestions: WeekViewSuggestion[] = filterSuggestionsByDay(suggestions, key);
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
                <span className={styles["day-date"]}>{formatDayOfMonth(d, timeZone)}</span>
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
                        {formatTime(slot.start, timeZone)}–{formatTime(slot.end, timeZone)}
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
                        {formatTime(s.start, timeZone)}–{formatTime(s.end, timeZone)}
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
