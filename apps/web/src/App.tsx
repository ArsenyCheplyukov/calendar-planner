import { useCallback, useEffect, useState } from "react";
import { getLocalTimeZone, ymdInTimeZone } from "@calendar-planner/shared";
import { Button } from "./components/Button/index.js";
import { PlanInput, type PlanInputResult } from "./components/PlanInput/index.js";
import { Suggestions } from "./components/Suggestions/index.js";
import {
  WeekView,
  type WeekViewBusyMap,
  type WeekViewWeek,
  type WeekViewSuggestion,
} from "./components/WeekView/index.js";
import { EventForm, type EventFormData } from "./components/EventForm/index.js";
import { PlanCandidates } from "./components/PlanCandidates/index.js";
import { EventsPopover, type EventItem } from "./components/EventsPopover/index.js";
import type { Suggestion, ParsedPlan, PlanCandidate } from "@calendar-planner/shared";
import styles from "./App.module.css";

type WeekResponse = {
  week: WeekViewWeek;
  busy: WeekViewBusyMap;
};

type WeekState =
  | { kind: "loading" }
  | { kind: "ready"; data: WeekResponse }
  | { kind: "error"; message: string };

type PlanState =
  | { kind: "idle" }
  | {
      kind: "ready";
      candidates: PlanCandidate[];
      selectedCandidateId: string;
      parsed: ParsedPlan;
      suggestions: Suggestion[];
      originalText: string;
    }
  | { kind: "error"; message: string };

type CreateState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

type EventsPopoverState =
  | { kind: "loading"; windowStart: string; windowEnd: string }
  | { kind: "ready"; windowStart: string; windowEnd: string; events: EventItem[] }
  | { kind: "error"; windowStart: string; windowEnd: string; message: string };

type EventFormState =
  | { kind: "closed" }
  | { kind: "manual" }
  | { kind: "suggestion"; suggestion: Suggestion; parsedPlan: ParsedPlan; originalPlanText: string };

type Toast = { id: number; message: string; tone: "success" | "error" };

function todayYmd(): string {
  return ymdInTimeZone(getLocalTimeZone(), new Date());
}

function isoToYmdInTimeZone(iso: string, timeZone: string): string {
  return ymdInTimeZone(timeZone, new Date(iso));
}

function addDaysYmd(ymd: string, days: number): string {
  const parts = ymd.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function buildWeekUrl(start: string | null): string {
  const tz = encodeURIComponent(getLocalTimeZone());
  if (start) {
    return `/api/week?start=${start}&timeZone=${tz}`;
  }
  return `/api/week?timeZone=${tz}`;
}

export function App() {
  const [weekState, setWeekState] = useState<WeekState>({ kind: "loading" });
  const [startParam, setStartParam] = useState<string | null>(null);
  const [planText, setPlanText] = useState("");
  const [planState, setPlanState] = useState<PlanState>({ kind: "idle" });
  const [eventForm, setEventForm] = useState<EventFormState>({ kind: "closed" });
  const [createState, setCreateState] = useState<CreateState>({ kind: "idle" });
  const [eventsState, setEventsState] = useState<EventsPopoverState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((message: string, tone: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  const fetchWeek = useCallback(async (start: string | null) => {
    setWeekState({ kind: "loading" });
    try {
      const res = await fetch(buildWeekUrl(start));
      if (res.status === 401) {
        setWeekState({
          kind: "error",
          message: "Not authenticated. Run `pnpm auth` to bootstrap credentials.",
        });
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as WeekResponse;
      setWeekState({ kind: "ready", data });
    } catch (e: unknown) {
      setWeekState({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  useEffect(() => {
    void fetchWeek(startParam);
  }, [fetchWeek, startParam]);

  const handlePrev = () => {
    setStartParam((current) => {
      const tz = getLocalTimeZone();
      const base =
        current ??
        (weekState.kind === "ready"
          ? isoToYmdInTimeZone(weekState.data.week.start, tz)
          : todayYmd());
      return addDaysYmd(base, -7);
    });
  };

  const handleNext = () => {
    setStartParam((current) => {
      const tz = getLocalTimeZone();
      const base =
        current ??
        (weekState.kind === "ready"
          ? isoToYmdInTimeZone(weekState.data.week.start, tz)
          : todayYmd());
      return addDaysYmd(base, 7);
    });
  };

  const handleToday = () => {
    setStartParam(null);
  };

  const handlePlanSubmit = useCallback(
    async (text: string): Promise<PlanInputResult | null> => {
      try {
        const res = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, timeZone: getLocalTimeZone() }),
        });
        if (res.status === 400) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          return { error: body.message ?? "Invalid plan" };
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          return { error: body.message ?? `HTTP ${res.status}` };
        }
        const body = (await res.json()) as {
          parsed: ParsedPlan;
          suggestions: Suggestion[];
          candidates?: PlanCandidate[];
          selectedCandidateId?: string;
        };
        const candidates: PlanCandidate[] =
          body.candidates && body.candidates.length > 0
            ? body.candidates
            : [
                {
                  candidateId: "candidate-1",
                  rank: 1,
                  parsedPlan: body.parsed,
                  suggestions: body.suggestions,
                },
              ];
        const selectedCandidateId = body.selectedCandidateId ?? candidates[0]!.candidateId;
        setPlanState({
          kind: "ready",
          candidates,
          selectedCandidateId,
          parsed: body.parsed,
          suggestions: body.suggestions,
          originalText: text,
        });
        return { parsed: body.parsed };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
    [],
  );

  const openManualForm = useCallback(() => {
    setCreateState({ kind: "idle" });
    setEventForm({ kind: "manual" });
  }, []);

  const handleCandidateSelect = useCallback((candidateId: string) => {
    setPlanState((current) => {
      if (current.kind !== "ready") return current;
      const candidate = current.candidates.find((c) => c.candidateId === candidateId);
      if (!candidate) return current;
      return {
        ...current,
        selectedCandidateId: candidateId,
        parsed: candidate.parsedPlan,
        suggestions: candidate.suggestions,
      };
    });
  }, []);

  const openSuggestionForm = useCallback((suggestion: Suggestion) => {
    if (planState.kind !== "ready") return;
    setCreateState({ kind: "idle" });
    setEventForm({
      kind: "suggestion",
      suggestion,
      parsedPlan: planState.parsed,
      originalPlanText: planState.originalText,
    });
  }, [planState]);

  const handleFormCancel = useCallback(() => {
    if (createState.kind === "submitting") return;
    setEventForm({ kind: "closed" });
    setCreateState({ kind: "idle" });
  }, [createState]);

  const handleFormSubmit = useCallback(
    async (data: EventFormData) => {
      setCreateState({ kind: "submitting" });
      const body: Record<string, unknown> = {
        slot: { start: data.start, end: data.end },
        title: data.title,
        description: data.description,
        location: data.location,
      };
      if (eventForm.kind === "suggestion") {
        body.parsedPlan = eventForm.parsedPlan;
        body.originalPlanText = eventForm.originalPlanText;
      }
      try {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const resBody = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(resBody.message ?? `HTTP ${res.status}`);
        }
        pushToast("Событие создано", "success");
        setEventForm({ kind: "closed" });
        setCreateState({ kind: "idle" });
        void fetchWeek(startParam);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setCreateState({ kind: "error", message });
        pushToast(`Не удалось: ${message}`, "error");
      }
    },
    [eventForm, pushToast, fetchWeek, startParam],
  );

  const handleBlockClick = useCallback(async (busySlot: { start: string; end: string }) => {
    setEventsState({ kind: "loading", windowStart: busySlot.start, windowEnd: busySlot.end });
    try {
      const res = await fetch(
        `/api/events?from=${encodeURIComponent(busySlot.start)}&to=${encodeURIComponent(busySlot.end)}`,
      );
      if (res.status === 401) {
        throw new Error("Не авторизован. Запустите pnpm auth.");
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { events: EventItem[] };
      setEventsState({
        kind: "ready",
        windowStart: busySlot.start,
        windowEnd: busySlot.end,
        events: body.events,
      });
    } catch (e) {
      setEventsState({
        kind: "error",
        windowStart: busySlot.start,
        windowEnd: busySlot.end,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  const handlePopoverClose = useCallback(() => {
    setEventsState(null);
  }, []);

  const suggestionsForWeek = useCallback((): WeekViewSuggestion[] => {
    if (planState.kind !== "ready") return [];
    if (weekState.kind !== "ready") return planState.suggestions;
    const ws = new Date(weekState.data.week.start).getTime();
    const we = new Date(weekState.data.week.end).getTime();
    return planState.suggestions.filter((s) => {
      const t = new Date(s.start).getTime();
      return t >= ws && t <= we;
    });
  }, [planState, weekState]);

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
              onApprove={openSuggestionForm}
              onSelect={openSuggestionForm}
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
                suggestions={suggestionsForWeek()}
                onPrev={handlePrev}
                onNext={handleNext}
                onToday={handleToday}
                onBlockClick={handleBlockClick}
                onSuggestionClick={(s) =>
                  openSuggestionForm({
                    start: s.start,
                    end: s.end,
                    score: s.score ?? 0,
                    reason: s.reason ?? "",
                  })
                }
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
