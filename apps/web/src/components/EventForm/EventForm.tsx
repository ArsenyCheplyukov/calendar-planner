import { useEffect, useMemo, useState } from "react";
import { Button } from "../Button/index.js";
import {
  getLocalTimeZone,
  getParts,
  dateFromParts,
} from "@calendar-planner/shared";
import styles from "./EventForm.module.css";

export interface EventFormData {
  title: string;
  start: string; // ISO datetime
  end: string;
  description: string;
  location: string;
}

export interface EventFormProps {
  initialTitle?: string;
  initialStart?: string;
  initialEnd?: string;
  initialDescription?: string;
  initialLocation?: string;
  submitLabel?: string;
  onSubmit: (data: EventFormData) => void;
  onCancel: () => void;
  submitting?: boolean;
  error?: string | null;
}

const COMMON_TIME_ZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Tokyo",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Pacific/Auckland",
];

function formatDateInput(iso: string, timeZone: string): string {
  const parts = getParts(timeZone, new Date(iso));
  const y = String(parts.year);
  const m = String(parts.month).padStart(2, "0");
  const d = String(parts.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTimeInput(iso: string, timeZone: string): string {
  const parts = getParts(timeZone, new Date(iso));
  const h = String(parts.hour).padStart(2, "0");
  const m = String(parts.minute).padStart(2, "0");
  return `${h}:${m}`;
}

function combineDateTimeToIso(
  dateInput: string,
  timeInput: string,
  timeZone: string,
): string {
  const [y, mo, d] = dateInput.split("-").map(Number);
  const [h, m] = timeInput.split(":").map(Number);
  return dateFromParts(timeZone, {
    year: y ?? 0,
    month: mo ?? 1,
    day: d ?? 1,
    hour: h ?? 0,
    minute: m ?? 0,
    second: 0,
    millisecond: 0,
  }).toISOString();
}

function defaultStart(timeZone: string): string {
  const now = new Date();
  return dateFromParts(timeZone, {
    ...getParts(timeZone, now),
    hour: 9,
    minute: 0,
    second: 0,
    millisecond: 0,
  }).toISOString();
}

function defaultEnd(timeZone: string): string {
  const start = new Date(defaultStart(timeZone));
  return new Date(start.getTime() + 60 * 60 * 1000).toISOString();
}

export function EventForm({
  initialTitle = "",
  initialStart,
  initialEnd,
  initialDescription = "",
  initialLocation = "",
  submitLabel = "Create event",
  onSubmit,
  onCancel,
  submitting = false,
  error,
}: EventFormProps) {
  const deviceTimeZone = useMemo(() => getLocalTimeZone(), []);
  const [timeZone, setTimeZone] = useState(deviceTimeZone);
  const [start, setStart] = useState(initialStart ?? defaultStart(timeZone));
  const [end, setEnd] = useState(initialEnd ?? defaultEnd(timeZone));
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [location, setLocation] = useState(initialLocation);

  useEffect(() => {
    setTitle(initialTitle);
    setDescription(initialDescription);
    setLocation(initialLocation);
    if (initialStart) setStart(initialStart);
    if (initialEnd) setEnd(initialEnd);
  }, [initialTitle, initialStart, initialEnd, initialDescription, initialLocation]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel, submitting]);

  const handleStartDateChange = (dateInput: string) => {
    setStart(
      combineDateTimeToIso(
        dateInput,
        formatTimeInput(start, timeZone),
        timeZone,
      ),
    );
  };
  const handleStartTimeChange = (timeInput: string) => {
    setStart(
      combineDateTimeToIso(
        formatDateInput(start, timeZone),
        timeInput,
        timeZone,
      ),
    );
  };
  const handleEndDateChange = (dateInput: string) => {
    setEnd(
      combineDateTimeToIso(
        dateInput,
        formatTimeInput(end, timeZone),
        timeZone,
      ),
    );
  };
  const handleEndTimeChange = (timeInput: string) => {
    setEnd(
      combineDateTimeToIso(
        formatDateInput(end, timeZone),
        timeInput,
        timeZone,
      ),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      start,
      end,
      description,
      location,
    });
  };

  return (
    <div className={styles["backdrop"]} onClick={submitting ? undefined : onCancel}>
      <div
        className={styles["dialog"]}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="event-form-title" className={styles["title"]}>
          {submitLabel}
        </h2>
        <form onSubmit={handleSubmit} className={styles["form"]}>
          <label className={styles["field"]}>
            <span className={styles["label"]}>Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={styles["input"]}
              required
              disabled={submitting}
            />
          </label>

          <div className={styles["row"]}>
            <label className={styles["field"]}>
              <span className={styles["label"]}>Start date</span>
              <input
                type="date"
                value={formatDateInput(start, timeZone)}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className={styles["input"]}
                required
                disabled={submitting}
              />
            </label>
            <label className={styles["field"]}>
              <span className={styles["label"]}>Start time</span>
              <input
                type="time"
                value={formatTimeInput(start, timeZone)}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className={styles["input"]}
                required
                disabled={submitting}
              />
            </label>
          </div>

          <div className={styles["row"]}>
            <label className={styles["field"]}>
              <span className={styles["label"]}>End date</span>
              <input
                type="date"
                value={formatDateInput(end, timeZone)}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className={styles["input"]}
                required
                disabled={submitting}
              />
            </label>
            <label className={styles["field"]}>
              <span className={styles["label"]}>End time</span>
              <input
                type="time"
                value={formatTimeInput(end, timeZone)}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className={styles["input"]}
                required
                disabled={submitting}
              />
            </label>
          </div>

          <label className={styles["field"]}>
            <span className={styles["label"]}>Time zone</span>
            <select
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              className={styles["input"]}
              disabled={submitting}
            >
              {COMMON_TIME_ZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>

          <label className={styles["field"]}>
            <span className={styles["label"]}>Location</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={styles["input"]}
              disabled={submitting}
            />
          </label>

          <label className={styles["field"]}>
            <span className={styles["label"]}>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles["textarea"]}
              rows={3}
              disabled={submitting}
            />
          </label>

          {error && (
            <div className={styles["error"]} role="alert">
              {error}
            </div>
          )}

          <div className={styles["actions"]}>
            <Button variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={submitting || !title.trim()}
            >
              {submitting ? "Creating…" : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
