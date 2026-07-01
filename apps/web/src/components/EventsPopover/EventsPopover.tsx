import { useEffect } from "react";
import { Button } from "../Button/index.js";
import styles from "./EventsPopover.module.css";

export interface EventItem {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay?: boolean;
}

export interface EventsPopoverProps {
  windowStart: string;
  windowEnd: string;
  events: EventItem[];
  loading: boolean;
  error?: string | null;
  onClose: () => void;
}

function formatTime(iso: string, allDay?: boolean): string {
  if (allDay) return "весь день";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
}

export function EventsPopover({
  windowStart,
  windowEnd,
  events,
  loading,
  error,
  onClose,
}: EventsPopoverProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className={styles["backdrop"]} onClick={onClose}>
      <div
        className={styles["dialog"]}
        role="dialog"
        aria-modal="true"
        aria-labelledby="events-popover-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="events-popover-title" className={styles["title"]}>
          События
        </h2>
        <div className={styles["window"]} data-testid="events-window">
          {formatDate(windowStart)}, {formatTime(windowStart)}–{formatTime(windowEnd)}
        </div>

        {loading && (
          <div className={styles["loading"]} data-testid="events-loading">
            Загрузка…
          </div>
        )}

        {error && !loading && (
          <div className={styles["error"]} data-testid="events-error" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className={styles["empty"]} data-testid="events-empty">
            Нет событий в этом окне.
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <div className={styles["list"]}>
            {events.map((e) => (
              <div key={e.id} className={styles["item"]}>
                <span className={styles["itemTitle"]}>{e.summary}</span>
                <span className={styles["itemTime"]}>
                  {formatTime(e.start, e.allDay)}–{formatTime(e.end, e.allDay)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className={styles["actions"]}>
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}
