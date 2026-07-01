import { useCallback, useEffect, useState } from "react";
import { PlanInput, type PlanInputResult } from "./components/PlanInput/index.js";
import { WeekView, type WeekViewBusyMap, type WeekViewWeek } from "./components/WeekView/index.js";
import styles from "./App.module.css";

type WeekResponse = {
  week: WeekViewWeek;
  busy: WeekViewBusyMap;
};

type WeekState =
  | { kind: "loading" }
  | { kind: "ready"; data: WeekResponse }
  | { kind: "error"; message: string };

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  return start ? `/api/week?start=${start}` : "/api/week";
}

export function App() {
  const [weekState, setWeekState] = useState<WeekState>({ kind: "loading" });
  const [startParam, setStartParam] = useState<string | null>(null);
  const [planText, setPlanText] = useState("");

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
      const base = current ?? todayYmd();
      return addDaysYmd(base, -7);
    });
  };

  const handleNext = () => {
    setStartParam((current) => {
      const base = current ?? todayYmd();
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
          body: JSON.stringify({ text }),
        });
        if (res.status === 400) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          return { error: body.message ?? "Invalid plan" };
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          return { error: body.message ?? `HTTP ${res.status}` };
        }
        const body = (await res.json()) as { parsed: unknown };
        return { parsed: body.parsed };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
    [],
  );

  return (
    <main className={styles["app"]} data-testid="app">
      <div className={styles["app-inner"]}>
        <h1 className={styles["app-title"]}>Calendar Planner</h1>
        <p className={styles["app-subtitle"]}>
          Single-user web app for placing plans into Google Calendar.
        </p>

        <PlanInput
          text={planText}
          onTextChange={setPlanText}
          onSubmit={handlePlanSubmit}
        />

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
              onPrev={handlePrev}
              onNext={handleNext}
              onToday={handleToday}
            />
          )}
        </div>
      </div>
    </main>
  );
}
