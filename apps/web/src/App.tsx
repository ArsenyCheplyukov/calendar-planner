import { useCallback, useMemo } from "react";
import { filterSuggestionsByWeek } from "@calendar-planner/shared";
import { Button } from "./components/Button/index.js";
import { PlanInput } from "./components/PlanInput/index.js";
import { Suggestions } from "./components/Suggestions/index.js";
import { WeekView, type WeekViewSuggestion } from "./components/WeekView/index.js";
import { EventForm } from "./components/EventForm/index.js";
import { PlanCandidates } from "./components/PlanCandidates/index.js";
import { EventsPopover } from "./components/EventsPopover/index.js";
import {
  useWeekNavigation,
  usePlanSubmission,
  useEventForm,
  useToasts,
  useEventsPopover,
} from "./hooks/index.js";
import styles from "./App.module.css";

export function App() {
  const { weekState, startParam, fetchWeek, handlePrev, handleNext, handleToday } =
    useWeekNavigation();
  const { planText, setPlanText, planState, handlePlanSubmit, handleCandidateSelect } =
    usePlanSubmission();
  const { toasts, pushToast } = useToasts();
  const { eventForm, createState, openManualForm, openSuggestionForm, handleFormCancel, handleFormSubmit } =
    useEventForm({ fetchWeek, startParam, pushToast });
  const { eventsState, handleBlockClick, handlePopoverClose } = useEventsPopover();

  const suggestionsForWeek = useMemo((): WeekViewSuggestion[] => {
    if (planState.kind !== "ready") return [];
    if (weekState.kind !== "ready") return planState.suggestions;
    return filterSuggestionsByWeek(
      planState.suggestions,
      weekState.data.week.start,
      weekState.data.week.end,
    );
  }, [planState, weekState]);

  const handleSuggestionClick = useCallback(
    (s: WeekViewSuggestion) => {
      if (planState.kind !== "ready") return;
      openSuggestionForm(
        { start: s.start, end: s.end, score: s.score ?? 0, reason: s.reason ?? "" },
        planState.parsed,
        planState.originalText,
      );
    },
    [planState, openSuggestionForm],
  );

  const formInitialValues =
    eventForm.kind === "suggestion"
      ? {
          initialTitle: eventForm.parsedPlan.title,
          initialStart: eventForm.suggestion.start,
          initialEnd: eventForm.suggestion.end,
          initialDescription: eventForm.originalPlanText,
          initialLocation: "",
        }
      : {};

  return (
    <main className={styles["app"]} data-testid="app">
      <div className={styles["app-inner"]}>
        <div className={styles["app-header"]}>
          <h1 className={styles["app-title"]}>Calendar Planner</h1>
          <a href="/settings" className={styles["settings-link"]} data-testid="settings-link">
            Settings
          </a>
        </div>
        <p className={styles["app-subtitle"]}>
          Single-user web app for placing plans into Google Calendar.
        </p>

        <PlanInput
          text={planText}
          onTextChange={setPlanText}
          onSubmit={handlePlanSubmit}
        />

        {planState.kind === "ready" && (
          <div style={{ marginTop: "var(--space-6)" }} data-testid="suggestions-section">
            <h2 className={styles["section-title"]}>Suggestions</h2>
            <PlanCandidates
              candidates={planState.candidates}
              selectedCandidateId={planState.selectedCandidateId}
              onSelect={handleCandidateSelect}
            />
            <Suggestions
              suggestions={planState.suggestions}
              onApprove={handleSuggestionClick}
              onSelect={handleSuggestionClick}
            />
          </div>
        )}

        {planState.kind === "error" && (
          <div className={styles["status-error"]} data-testid="plan-error">
            {planState.message}
          </div>
        )}

        <div style={{ marginTop: "var(--space-6)" }}>
          {weekState.kind === "loading" && (
            <div className={styles["status-loading"]} data-testid="week-loading">
              Loading week…
            </div>
          )}

          {weekState.kind === "error" && (
            <div className={styles["status-error"]} data-testid="week-error">
              {weekState.message}
            </div>
          )}

          {weekState.kind === "ready" && (
            <>
              <div style={{ marginBottom: "var(--space-3)", display: "flex", justifyContent: "flex-end" }}>
                <Button variant="primary" size="sm" onClick={openManualForm} data-testid="create-event-button">
                  Create event
                </Button>
              </div>
              <WeekView
                week={weekState.data.week}
                busy={weekState.data.busy}
                suggestions={suggestionsForWeek}
                onPrev={handlePrev}
                onNext={handleNext}
                onToday={handleToday}
                onBlockClick={handleBlockClick}
                onSuggestionClick={handleSuggestionClick}
              />
            </>
          )}
        </div>
      </div>

      {eventForm.kind !== "closed" && (
        <EventForm
          {...formInitialValues}
          submitLabel="Create event"
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          submitting={createState.kind === "submitting"}
          error={createState.kind === "error" ? createState.message : null}
        />
      )}

      {eventsState && (
        <EventsPopover
          windowStart={eventsState.windowStart}
          windowEnd={eventsState.windowEnd}
          events={eventsState.kind === "ready" ? eventsState.events : []}
          loading={eventsState.kind === "loading"}
          error={eventsState.kind === "error" ? eventsState.message : null}
          onClose={handlePopoverClose}
        />
      )}

      {toasts.length > 0 && (
        <div style={{ position: "fixed", bottom: "var(--space-4)", right: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)", zIndex: 200 }}>
          {toasts.map((t) => (
            <div
              key={t.id}
              data-testid={t.tone === "success" ? "create-toast" : "error-toast"}
              style={{
                padding: "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-md)",
                background: t.tone === "success" ? "var(--color-success)" : "var(--color-destructive)",
                color: t.tone === "success" ? "var(--color-success-fg)" : "var(--color-destructive-fg)",
                boxShadow: "var(--shadow-2)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
