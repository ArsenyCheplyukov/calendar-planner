import { useCallback, useRef } from "react";
import type { PlanCandidate } from "@calendar-planner/shared";
import { Button } from "./components/Button/index.js";
import { PlanInput } from "./components/PlanInput/index.js";
import { WeekView } from "./components/WeekView/index.js";
import { EventForm } from "./components/EventForm/index.js";
import { PlanCandidates } from "./components/PlanCandidates/index.js";
import { EventsPopover, type EventItem } from "./components/EventsPopover/index.js";
import type { WeekViewProposal } from "./components/WeekView/WeekView.js";
import {
  useWeekNavigation,
  usePlanSubmission,
  useEventForm,
  useToasts,
  useEventsPopover,
} from "./hooks/index.js";
import styles from "./App.module.css";

export function App() {
  const planTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { weekState, startParam, fetchWeek, handlePrev, handleNext, handleToday } =
    useWeekNavigation();
  const { planText, setPlanText, planState, handlePlanSubmit, handleCandidateSelect } =
    usePlanSubmission();

  const handleRegenerate = useCallback(() => {
    if (planState.kind !== "ready") return;
    setPlanText(planState.originalText);
    planTextareaRef.current?.focus();
  }, [planState, setPlanText]);
  const { toasts, pushToast } = useToasts();
  const { eventForm, createState, openManualForm, openSuggestionForm, openEditForm, handleFormCancel, handleFormSubmit } =
    useEventForm({ fetchWeek, startParam, pushToast });
  const { eventsState, handleBlockClick, handlePopoverClose } = useEventsPopover();

  const handleEventEdit = useCallback(
    (event: EventItem) => {
      handlePopoverClose();
      openEditForm(event.id, {
        title: event.summary,
        start: event.start,
        end: event.end,
        description: event.description ?? "",
        location: event.location ?? "",
        type: event.type,
      });
    },
    [handlePopoverClose, openEditForm],
  );

  const handleEventDelete = useCallback(
    async (event: EventItem) => {
      try {
        const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? `HTTP ${res.status}`);
        }
        pushToast("Событие удалено", "success");
        handlePopoverClose();
        void fetchWeek(startParam);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        pushToast(`Не удалось удалить: ${message}`, "error");
      }
    },
    [fetchWeek, handlePopoverClose, pushToast, startParam],
  );

  const handleCandidateApprove = useCallback(
    (candidate: PlanCandidate) => {
      if (planState.kind !== "ready") return;
      const suggestion = candidate.suggestions[0];
      if (!suggestion) return;
      openSuggestionForm(suggestion, candidate.parsedPlan, planState.originalText);
    },
    [planState, openSuggestionForm],
  );

  const proposals: WeekViewProposal[] =
    planState.kind === "ready"
      ? planState.candidates
          .map((c) => ({ candidateId: c.candidateId, suggestion: c.suggestions[0], selected: c.candidateId === planState.selectedCandidateId }))
          .filter((p): p is WeekViewProposal => !!p.suggestion)
      : [];

  const formInitialValues =
    eventForm.kind === "suggestion"
      ? {
          initialTitle: eventForm.parsedPlan.title,
          initialStart: eventForm.suggestion.start,
          initialEnd: eventForm.suggestion.end,
          initialDescription: eventForm.originalPlanText,
          initialLocation: "",
          initialType: eventForm.parsedPlan.type,
        }
      : eventForm.kind === "edit"
        ? {
            initialTitle: eventForm.event.title,
            initialStart: eventForm.event.start,
            initialEnd: eventForm.event.end,
            initialDescription: eventForm.event.description,
            initialLocation: eventForm.event.location,
            initialType: eventForm.event.type,
          }
        : {};

  const submitLabel = eventForm.kind === "edit" ? "Save changes" : "Create event";

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
          ref={planTextareaRef}
          text={planText}
          onTextChange={setPlanText}
          onSubmit={handlePlanSubmit}
        />

        {planState.kind === "ready" && (
          <div style={{ marginTop: "var(--space-6)" }} data-testid="suggestions-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
              <h2 className={styles["section-title"]} style={{ margin: 0 }}>Suggestions</h2>
              <Button variant="ghost" size="sm" onClick={handleRegenerate} data-testid="regenerate-button">
                Regenerate
              </Button>
            </div>
            <PlanCandidates
              candidates={planState.candidates}
              selectedCandidateId={planState.selectedCandidateId}
              onSelect={handleCandidateSelect}
              onApprove={handleCandidateApprove}
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
                proposals={proposals}
                onPrev={handlePrev}
                onNext={handleNext}
                onToday={handleToday}
                onBlockClick={handleBlockClick}
                onProposalClick={handleCandidateSelect}
              />
            </>
          )}
        </div>
      </div>

      {eventForm.kind !== "closed" && (
        <EventForm
          {...formInitialValues}
          submitLabel={submitLabel}
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
          onEdit={handleEventEdit}
          onDelete={handleEventDelete}
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
