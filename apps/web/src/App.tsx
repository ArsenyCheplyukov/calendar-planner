import { useCallback, useEffect, useState } from "react";
import { PlanInput, type PlanInputResult } from "./components/PlanInput/index.js";
import { Suggestions } from "./components/Suggestions/index.js";
import {
  WeekView,
  type WeekViewBusyMap,
  type WeekViewWeek,
  type WeekViewSuggestion,
} from "./components/WeekView/index.js";
import { ConfirmModal } from "./components/ConfirmModal/index.js";
import { EventsPopover, type EventItem } from "./components/EventsPopover/index.js";
import type { Suggestion, ParsedPlan } from "@calendar-planner/shared";
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
  | { kind: "ready"; parsed: ParsedPlan; suggestions: Suggestion[]; originalText: string }
  | { kind: "error"; message: string };

type CreateState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

type EventsPopoverState =
  | { kind: "loading"; windowStart: string; windowEnd: string }
  | { kind: "ready"; windowStart: string; windowEnd: string; events: EventItem[] }
  | { kind: "error"; windowStart: string; windowEnd: string; message: string };

type Toast = { id: number; message: string; tone: "success" | "error" };

function getDeviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function todayYmd(): string {
  const tz = getDeviceTimeZone();
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
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

function isoToYmdInTimeZone(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function buildWeekUrl(start: string | null): string {
  const tz = encodeURIComponent(getDeviceTimeZone());
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
  const [pendingSuggestion, setPendingSuggestion] = useState<Suggestion | null>(null);
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
      const tz = getDeviceTimeZone();
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
      const tz = getDeviceTimeZone();
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
          body: JSON.stringify({ text, timeZone: getDeviceTimeZone() }),
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
        };
        setPlanState({
          kind: "ready",
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

  const handleApprove = useCallback((suggestion: Suggestion) => {
    setCreateState({ kind: "idle" });
    setPendingSuggestion(suggestion);
  }, []);

  const handleCancel = useCallback(() => {
    if (createState.kind === "submitting") return;
    setPendingSuggestion(null);
    setCreateState({ kind: "idle" });
  }, [createState]);

  const handleConfirm = useCallback(async () => {
    if (planState.kind !== "ready" || !pendingSuggestion) return;
    setCreateState({ kind: "submitting" });
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot: { start: pendingSuggestion.start, end: pendingSuggestion.end },
          parsedPlan: planState.parsed,
          originalPlanText: planState.originalText,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      pushToast("Событие создано", "success");
      setPendingSuggestion(null);
      setCreateState({ kind: "idle" });
      void fetchWeek(startParam);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setCreateState({ kind: "error", message });
      pushToast(`Не удалось: ${message}`, "error");
    }
  }, [planState, pendingSuggestion, pushToast, fetchWeek, startParam]);

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
            <Suggestions
              suggestions={planState.suggestions}
              onApprove={handleApprove}
              onSelect={handleApprove}
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
            <WeekView
              week={weekState.data.week}
              busy={weekState.data.busy}
              suggestions={suggestionsForWeek()}
              onPrev={handlePrev}
              onNext={handleNext}
              onToday={handleToday}
              onBlockClick={handleBlockClick}
              onSuggestionClick={(s) =>
                handleApprove({
                  start: s.start,
                  end: s.end,
                  score: s.score ?? 0,
                  reason: s.reason ?? "",
                })
              }
            />
          )}
        </div>
      </div>

      {pendingSuggestion && planState.kind === "ready" && (
        <ConfirmModal
          suggestion={pendingSuggestion}
          parsedPlan={planState.parsed}
          originalPlanText={planState.originalText}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
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
