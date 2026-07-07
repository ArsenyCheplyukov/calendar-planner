import { useMemo } from "react";
import type { BusyMap, CalendarEvent, Suggestion } from "@calendar-planner/shared";
import { getLocalTimeZone } from "@calendar-planner/shared";
import { Button } from "../Button/index.js";
import {
  formatTime,
  formatYmd,
  formatDayOfMonth,
  formatWeekRange,
  addDays,
} from "../../lib/time-format.js";
import styles from "./WeekView.module.css";

export interface WeekViewProposal {
  candidateId: string;
  suggestion: Suggestion;
  selected: boolean;
}

export interface WeekViewWeek {
  start: string; // ISO datetime
  end: string;   // ISO datetime
}

export type WeekViewBusyMap = BusyMap;

export interface WeekViewProps {
  week: WeekViewWeek;
  busy: BusyMap;
  proposals?: WeekViewProposal[];
  events?: CalendarEvent[];
  today?: string; // YYYY-MM-DD; defaults to "now" in local time
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onBlockClick?: (busySlot: { start: string; end: string }) => void;
  onProposalClick?: (candidateId: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

const DAY_NAMES_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function WeekView({
  week,
  busy,
  proposals = [],
  events = [],
  today,
  onPrev,
  onNext,
  onToday,
  onBlockClick,
  onProposalClick,
  onEventClick,
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

  const proposalsByDay = useMemo(() => {
    const map: Record<string, WeekViewProposal[]> = {};
    for (const p of proposals) {
      const key = formatYmd(new Date(p.suggestion.start), timeZone);
      (map[key] ??= []).push(p);
    }
    for (const key of Object.keys(map)) {
      map[key]!.sort((a, b) => a.suggestion.start.localeCompare(b.suggestion.start));
    }
    return map;
  }, [proposals, timeZone]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
      const key = formatYmd(new Date(e.start), timeZone);
      (map[key] ??= []).push(e);
    }
    for (const key of Object.keys(map)) {
      map[key]!.sort((a, b) => a.start.localeCompare(b.start));
    }
    return map;
  }, [events, timeZone]);

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
          const dayProposals = proposalsByDay[key] ?? [];
          const dayEvents = eventsByDay[key] ?? [];
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
                {dayProposals.length === 0 && dayBusy.length === 0 && dayEvents.length === 0 ? (
                  <span className={styles["empty"]}>—</span>
                ) : (
                  <>
                    {dayEvents
                      .filter((e) => e.allDay)
                      .map((e, idx) => (
                        <button
                          key={`event-all-day-${e.id}-${idx}`}
                          type="button"
                          className={`${styles["event-block"]} ${styles["event-block-all-day"]}`}
                          data-testid="event-block"
                          data-type={e.type}
                          data-all-day="true"
                          onClick={() => onEventClick?.(e)}
                        >
                          {e.summary}
                        </button>
                      ))}
                    {dayEvents
                      .filter((e) => !e.allDay)
                      .map((e, idx) => (
                        <button
                          key={`event-${e.id}-${idx}`}
                          type="button"
                          className={styles["event-block"]}
                          data-testid="event-block"
                          data-type={e.type}
                          data-all-day="false"
                          onClick={() => onEventClick?.(e)}
                        >
                          <span className={styles["event-time"]}>
                            {formatTime(e.start, timeZone)}–{formatTime(e.end, timeZone)}
                          </span>
                          <span className={styles["event-title"]}>{e.summary}</span>
                        </button>
                      ))}
                    {dayProposals.map((p, idx) => (
                      <button
                        key={`proposal-${p.candidateId}-${idx}`}
                        type="button"
                        className={`${styles["proposal-block"]} ${p.selected ? styles["proposal-block-selected"] : ""}`}
                        data-testid="proposal-block"
                        data-selected={p.selected ? "true" : "false"}
                        onClick={() => onProposalClick?.(p.candidateId)}
                      >
                        {formatTime(p.suggestion.start, timeZone)}–{formatTime(p.suggestion.end, timeZone)}
                      </button>
                    ))}
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
