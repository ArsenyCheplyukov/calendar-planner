import { useCallback, useMemo, useRef } from "react";
import type { EventType, PlanCandidate, Suggestion } from "@calendar-planner/shared";
import { DEFAULT_PREFERENCES } from "@calendar-planner/shared";
import { Button } from "./components/Button/index.js";
import { PlanInput } from "./components/PlanInput/index.js";
import { WeekView } from "./components/WeekView/index.js";
import { EventForm } from "./components/EventForm/index.js";
import { PlanCandidates } from "./components/PlanCandidates/index.js";
import { Suggestions } from "./components/Suggestions/index.js";
import { EventsPopover, type EventItem } from "./components/EventsPopover/index.js";
import type { WeekViewProposal } from "./components/WeekView/WeekView.js";
import {
  useWeekNavigation,
  usePlanSubmission,
  useEventForm,
  useToasts,
  useEventsPopover,
  usePreferences,
  useCalendarEvents,
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
  const { toasts, pushToast, dismissToast } = useToasts();
  const {
    eventForm,
    createState,
    openManualForm,
    openSuggestionForm,
    openEditForm,
    handleFormCancel,
    handleFormSubmit,
    cancelUndo,
  } = useEventForm({ fetchWeek, startParam, pushToast, dismissToast });
  const { eventsState, handleBlockClick, handlePopoverClose } = useEventsPopover();

  const eventsRange =
    weekState.kind === "ready"
      ? { from: weekState.data.week.start, to: weekState.data.week.end }
      : { from: undefined, to: undefined };
  const calendarEventsState = useCalendarEvents(eventsRange);
  const calendarEvents =
    calendarEventsState.state.kind === "ready" ? calendarEventsState.state.events : [];

  const preferencesState = usePreferences();
  const bufferMinutes =
    preferencesState.kind === "ready"
      ? preferencesState.bufferMinutes
      : DEFAULT_PREFERENCES.bufferMinutes;

  const busyMap = useMemo(
    () => (weekState.kind === "ready" ? weekState.data.busy : {}),
    [weekState],
  );

  const handleEventEdit = useCallback(
    async (event: EventItem) => {
      handlePopoverClose();
      try {
        const res = await fetch(`/api/events/${event.id}`);
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? `HTTP ${res.status}`);
        }
        const body = (await res.json()) as {
          event: {
            id: string;
            summary?: string;
            start?: { dateTime?: string; date?: string };
            end?: { dateTime?: string; date?: string };
            description?: string;
            location?: string;
            type?: EventType;
          };
        };
        const ev = body.event;
        const start = ev.start?.dateTime ?? ev.start?.date ?? event.start;
        const end = ev.end?.dateTime ?? ev.end?.date ?? event.end;
        openEditForm(ev.id, {
          title: ev.summary ?? event.summary,
          start,
          end,
          description: ev.description ?? "",
          location: ev.location ?? "",
          type: ev.type ?? event.type,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        pushToast(`Не удалось загрузить событие: ${message}`, "error");
      }
    },
    [handlePopoverClose, openEditForm, pushToast],
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

  const handlePrevWithCancel = useCallback(() => {
    cancelUndo();
    handlePrev();
  }, [cancelUndo, handlePrev]);

  const handleNextWithCancel = useCallback(() => {
    cancelUndo();
    handleNext();
  }, [cancelUndo, handleNext]);

  const handleTodayWithCancel = useCallback(() => {
    cancelUndo();
    handleToday();
  }, [cancelUndo, handleToday]);

  const handleCandidateApprove = useCallback(
    (candidate: PlanCandidate) => {
      if (planState.kind !== "ready") return;
      const suggestion = candidate.suggestions[0];
      if (!suggestion) return;
      openSuggestionForm(suggestion, candidate.parsedPlan, planState.originalText);
    },
    [planState, openSuggestionForm],
  );

  const handleBulkCreate = useCallback(
    async (selected: Suggestion[]) => {
      if (planState.kind !== "ready" || selected.length === 0) return;
      const candidate = planState.candidates.find(
        (c) => c.candidateId === planState.selectedCandidateId,
      );
      if (!candidate) return;

      let created = 0;
      const failures: string[] = [];
      for (const s of selected) {
        try {
          const res = await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slot: { start: s.start, end: s.end },
              parsedPlan: candidate.parsedPlan,
              originalPlanText: planState.originalText,
            }),
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { message?: string };
            throw new Error(body.message ?? `HTTP ${res.status}`);
          }
          created++;
        } catch (e) {
          failures.push(e instanceof Error ? e.message : String(e));
        }
      }

      const allFailed = failures.length > 0 && created === 0;
      const message =
        failures.length === 0
          ? `Created ${created} events`
          : `Created ${created} of ${selected.length}. Failures: ${failures.join(", ")}`;
      pushToast(message, allFailed ? "error" : "success");
      void fetchWeek(startParam);
    },
    [fetchWeek, planState, pushToast, startParam],
  );

  const proposals: WeekViewProposal[] =
    planState.kind === "ready"
      ? planState.candidates
          .map((c) => ({ candidateId: c.candidateId, suggestion: c.suggestions[0], selected: c.candidateId === planState.selectedCandidateId }))
          .filter((p): p is WeekViewProposal => !!p.suggestion)
      : [];

  const activeCandidateSuggestions: Suggestion[] =
    planState.kind === "ready"
      ? planState.candidates.find((c) => c.candidateId === planState.selectedCandidateId)?.suggestions ?? []
      : [];

  const formExcludeInterval =
    eventForm.kind === "edit"
      ? { start: eventForm.event.start, end: eventForm.event.end }
      : undefined;

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
            <div style={{ marginTop: "var(--space-3)" }}>
              <Suggestions
                suggestions={activeCandidateSuggestions}
                busy={busyMap}
                bufferMinutes={bufferMinutes}
                onApprove={(suggestion) => {
                  if (planState.kind !== "ready") return;
                  const candidate = planState.candidates.find(
                    (c) => c.candidateId === planState.selectedCandidateId,
                  );
                  if (!candidate) return;
                  openSuggestionForm(suggestion, candidate.parsedPlan, planState.originalText);
                }}
                onBulkCreate={handleBulkCreate}
              />
            </div>
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
                events={calendarEvents}
                onPrev={handlePrevWithCancel}
                onNext={handleNextWithCancel}
                onToday={handleTodayWithCancel}
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
          busy={busyMap}
          bufferMinutes={bufferMinutes}
          excludeInterval={formExcludeInterval}
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
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
              }}
            >
              <span>{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={t.action.onClick}
                  style={{
                    background: "transparent",
                    border: "1px solid currentColor",
                    borderRadius: "var(--radius-sm)",
                    color: "inherit",
                    cursor: "pointer",
                    fontSize: "var(--font-size-xs)",
                    padding: "var(--space-1) var(--space-2)",
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
