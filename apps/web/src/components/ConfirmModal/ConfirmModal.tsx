import { useEffect } from "react";
import { Button } from "../Button/index.js";
import type { Suggestion, ParsedPlan } from "@calendar-planner/shared";
import styles from "./ConfirmModal.module.css";

export interface ConfirmModalProps {
  suggestion: Suggestion;
  parsedPlan: ParsedPlan;
  originalPlanText: string;
  onConfirm: () => void;
  onCancel: () => void;
  submitting?: boolean;
  error?: string | null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const days = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  return `${d.getDate()} ${["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"][d.getMonth()]} ${days[d.getDay()]}`;
}

export function ConfirmModal({
  suggestion,
  parsedPlan,
  originalPlanText,
  onConfirm,
  onCancel,
  submitting = false,
  error,
}: ConfirmModalProps) {
  // Allow Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel, submitting]);

  return (
    <div className={styles["backdrop"]} onClick={submitting ? undefined : onCancel}>
      <div
        className={styles["dialog"]}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className={styles["title"]}>
          Создать событие?
        </h2>

        <div className={styles["row"]}>
          <span className={styles["label"]}>Название</span>
          <span className={styles["value"]} data-testid="confirm-title-value">
            {parsedPlan.title}
          </span>
        </div>

        <div className={styles["row"]}>
          <span className={styles["label"]}>Когда</span>
          <span className={styles["valueMono"]} data-testid="confirm-when">
            {formatDate(suggestion.start)}, {formatTime(suggestion.start)}–{formatTime(suggestion.end)}
          </span>
        </div>

        <div className={styles["row"]}>
          <span className={styles["label"]}>План</span>
          <div className={styles["planText"]} data-testid="confirm-plan-text">
            {originalPlanText}
          </div>
        </div>

        {error && (
          <div className={styles["error"]} data-testid="confirm-error" role="alert">
            {error}
          </div>
        )}

        <div className={styles["actions"]}>
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Отмена
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={submitting}>
            {submitting ? "Создаю…" : "Создать"}
          </Button>
        </div>
      </div>
    </div>
  );
}
