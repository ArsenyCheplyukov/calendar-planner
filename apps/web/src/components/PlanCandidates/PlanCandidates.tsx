import { useState } from "react";
import type { PlanCandidate } from "@calendar-planner/shared";
import styles from "./PlanCandidates.module.css";

const DEFAULT_VISIBLE_COUNT = 10;

const DAY_NAMES_RU = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
];

const TIME_OF_DAY_RU: Record<"morning" | "midday" | "evening", string> = {
  morning: "утро",
  midday: "день",
  evening: "вечер",
};

const DAY_INDEX: Record<string, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 0,
};

export interface PlanCandidatesProps {
  candidates: PlanCandidate[];
  selectedCandidateId: string;
  onSelect: (candidateId: string) => void;
}

function formatHint(hint?: PlanCandidate["parsedPlan"]["hint"]): string | null {
  if (!hint?.window) return null;
  const parts: string[] = [];
  if (hint.window.dayOfWeek) {
    const dayIndex = DAY_INDEX[hint.window.dayOfWeek];
    parts.push(dayIndex !== undefined ? DAY_NAMES_RU[dayIndex]! : hint.window.dayOfWeek);
  }
  if (hint.window.timeOfDay) {
    parts.push(TIME_OF_DAY_RU[hint.window.timeOfDay] ?? hint.window.timeOfDay);
  }
  if (hint.window.date) {
    parts.push(hint.window.date);
  }
  return parts.join(", ");
}

export function PlanCandidates({ candidates, selectedCandidateId, onSelect }: PlanCandidatesProps) {
  if (candidates.length <= 1) {
    return null;
  }

  const [expanded, setExpanded] = useState(false);
  const visibleCount = expanded ? candidates.length : Math.min(DEFAULT_VISIBLE_COUNT, candidates.length);
  const visible = candidates.slice(0, visibleCount);
  const hasMore = candidates.length > DEFAULT_VISIBLE_COUNT && !expanded;

  return (
    <div className={styles["list"]} data-testid="plan-candidates">
      {visible.map((candidate) => {
        const hintText = formatHint(candidate.parsedPlan.hint);
        const label = hintText
          ? `${candidate.parsedPlan.title} (${hintText})`
          : candidate.parsedPlan.title;
        const isSelected = candidate.candidateId === selectedCandidateId;

        return (
          <label
            key={candidate.candidateId}
            className={`${styles["item"]} ${isSelected ? styles["selected"] : ""}`}
            data-testid="plan-candidate-item"
          >
            <input
              type="radio"
              name="plan-candidate"
              value={candidate.candidateId}
              checked={isSelected}
              onChange={() => onSelect(candidate.candidateId)}
            />
            <span className={styles["label"]}>{label}</span>
          </label>
        );
      })}
      {hasMore && (
        <button
          type="button"
          className={styles["expand"]}
          onClick={() => setExpanded(true)}
        >
          Show more
        </button>
      )}
    </div>
  );
}
