import type { PlanCandidate, Suggestion } from "@calendar-planner/shared";
import { Button } from "../Button/index.js";
import { formatTime, formatDayName } from "../../lib/time-format.js";
import styles from "./PlanCandidates.module.css";

export interface PlanCandidatesProps {
  candidates: PlanCandidate[];
  selectedCandidateId: string;
  onSelect: (candidateId: string) => void;
  onApprove?: (candidate: PlanCandidate) => void;
}

function topSuggestion(candidate: PlanCandidate): Suggestion | null {
  return candidate.suggestions[0] ?? null;
}

export function PlanCandidates({ candidates, selectedCandidateId, onSelect, onApprove }: PlanCandidatesProps) {
  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className={styles["list"]} data-testid="plan-candidates">
      {candidates.map((candidate) => {
        const isSelected = candidate.candidateId === selectedCandidateId;
        const suggestion = topSuggestion(candidate);

        return (
          <div
            key={candidate.candidateId}
            className={`${styles["card"]} ${isSelected ? styles["selected"] : ""}`}
            data-testid="plan-candidate-card"
            data-selected={isSelected ? "true" : "false"}
            onClick={() => onSelect(candidate.candidateId)}
          >
            <div className={styles["row"]}>
              <span className={styles["title"]}>{candidate.parsedPlan.title}</span>
              {suggestion && (
                <span className={styles["score"]}>{Math.round(suggestion.score * 100)}%</span>
              )}
            </div>
            {suggestion ? (
              <div className={styles["time"]} data-testid="candidate-time">
                {formatDayName(suggestion.start)} {formatTime(suggestion.start)}–{formatTime(suggestion.end)}
              </div>
            ) : (
              <div className={styles["no-slot"]}>Нет подходящего слота</div>
            )}
            {suggestion && (
              <div className={styles["reason"]}>{suggestion.reason}</div>
            )}
            <div className={styles["footer"]}>
              <Button
                variant="primary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove?.(candidate);
                }}
              >
                Add event
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
