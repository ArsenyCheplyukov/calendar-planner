import { useState } from "react";
import { Button } from "../Button/index.js";
import { Card } from "../Card/index.js";
import styles from "./PlanInput.module.css";

export interface PlanInputResult {
  parsed?: unknown;
  error?: string;
}

export interface PlanInputProps {
  text: string;
  onTextChange: (next: string) => void;
  onSubmit: (text: string) => Promise<PlanInputResult | null>;
  placeholder?: string;
  initialResult?: unknown;
}

export function PlanInput({
  text,
  onTextChange,
  onSubmit,
  placeholder = "Опишите план: что, на сколько, к какому сроку…",
  initialResult,
}: PlanInputProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<unknown | null>(
    initialResult ?? null,
  );

  const handleClick = async () => {
    if (submitting) return;
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await onSubmit(trimmed);
      if (result === null) return;
      if (result.error) {
        setError(result.error);
      } else if (result.parsed !== undefined) {
        setLastResult(result.parsed);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card padding="md" data-testid="plan-input">
      <div className={styles["plan"]}>
        <label
          htmlFor="plan-textarea"
          style={{
            fontSize: "var(--font-size-sm)",
            fontWeight: "var(--font-weight-medium)",
            color: "var(--color-fg-muted)",
          }}
        >
          План
        </label>
        <textarea
          id="plan-textarea"
          className={styles["textarea"]}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={placeholder}
          disabled={submitting}
          aria-label="План"
        />
        <div className={styles["actions"]}>
          <Button
            onClick={handleClick}
            disabled={submitting || text.trim().length === 0}
          >
            {submitting ? "Думаю…" : "Suggest"}
          </Button>
        </div>

        {error && (
          <div className={styles["error"]} data-testid="plan-error" role="alert">
            {error}
          </div>
        )}

        {import.meta.env.DEV && lastResult !== null && (
          <details className={styles["debug"]} data-testid="plan-debug">
            <summary>Parsed plan (debug)</summary>
            <pre>{JSON.stringify(lastResult, null, 2)}</pre>
          </details>
        )}
      </div>
    </Card>
  );
}
