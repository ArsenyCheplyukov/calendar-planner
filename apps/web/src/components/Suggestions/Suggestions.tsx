import type { Suggestion } from "@calendar-planner/shared";
import { Button } from "../Button/index.js";
import { formatTime, formatDayName } from "../../lib/time-format.js";
import styles from "./Suggestions.module.css";

export type SuggestionsList = Suggestion[];

export interface SuggestionsProps {
  suggestions: SuggestionsList;
  onApprove: (suggestion: Suggestion) => void;
  onSelect?: (suggestion: Suggestion) => void;
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
          <span className={styles["badge"]} data-testid="suggestion-badge">
            Suggested
          </span>
          <div data-testid="suggestion-time" className={styles["time"]}>
            {formatDayName(s.start)} {formatTime(s.start)}–{formatTime(s.end)}
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
            Add event
          </Button>
        </div>
      ))}
    </div>
  );
}
