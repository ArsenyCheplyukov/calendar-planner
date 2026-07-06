import { useEffect } from "react";
import type { EventType } from "@calendar-planner/shared";
import { Button } from "../Button/index.js";
import { formatTime, formatDateLong } from "../../lib/time-format.js";
import styles from "./EventsPopover.module.css";

export interface EventItem {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay?: boolean;
  type: EventType;
  description?: string;
  location?: string;
}

export interface EventsPopoverProps {
  windowStart: string;
  windowEnd: string;
  events: EventItem[];
  loading: boolean;
  error?: string | null;
  onClose: () => void;
  onEdit?: (event: EventItem) => void;
  onDelete?: (event: EventItem) => void;
}

export function EventsPopover({
  windowStart,
  windowEnd,
  events,
  loading,
  error,
  onClose,
  onEdit,
  onDelete,
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
          {formatDateLong(windowStart)}, {formatTime(windowStart)}–{formatTime(windowEnd)}
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
                <div className={styles["itemRow"]}>
                  <span className={styles["itemTitle"]}>{e.summary}</span>
                  <span className={styles["itemTime"]}>
                    {e.allDay ? "весь день" : `${formatTime(e.start)}–${formatTime(e.end)}`}
                  </span>
                </div>
                <div className={styles["itemActions"]}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onEdit?.(e)}
                    data-testid="edit-event-button"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete?.(e)}
                    data-testid="delete-event-button"
                  >
                    Delete
                  </Button>
                </div>
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
