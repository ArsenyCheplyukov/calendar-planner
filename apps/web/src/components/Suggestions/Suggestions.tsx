import type { Suggestion } from "@calendar-planner/shared";
import { Button } from "../Button/index.js";
import styles from "./Suggestions.module.css";

export type SuggestionsList = Suggestion[];

export interface SuggestionsProps {
  suggestions: SuggestionsList;
  onApprove: (suggestion: Suggestion) => void;
  onSelect?: (suggestion: Suggestion) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const days = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  return days[d.getDay()] ?? "";
}

export function Suggestions({ suggestions, onApprove, onSelect }: SuggestionsProps) {
  if (suggestions.length === 0) {
    return (
      <div className={styles["empty"]} data-testid="suggestions-empty">
        Нет свободных слотов на этой неделе. Попробуйте следующую.
      </div>
    );
  }

  return (
    <div className={styles["list"]} data-testid="suggestions-list">
      {suggestions.map((s, idx) => (
        <div
          key={`${s.start}-${idx}`}
          className={styles["card"]}
          data-testid="suggestion-card"
          onClick={() => onSelect?.(s)}
        >
          <div data-testid="suggestion-time" className={styles["time"]}>
            {formatDay(s.start)} {formatTime(s.start)}–{formatTime(s.end)}
          </div>
          <div className={styles["reason"]}>{s.reason}</div>
          <div className={styles["score"]}>{Math.round(s.score * 100)}%</div>
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onApprove(s);
            }}
          >
            Place here
          </Button>
        </div>
      ))}
    </div>
  );
}
