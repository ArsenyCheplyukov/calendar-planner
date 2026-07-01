import { useEffect, useState } from "react";
import { Card } from "./components/Card/index.js";
import { Surface } from "./components/Surface/index.js";
import styles from "./App.module.css";

type HealthResponse = { status: string };

type HealthState =
  | { kind: "loading" }
  | { kind: "ok"; data: HealthResponse }
  | { kind: "error"; message: string };

export function App() {
  const [state, setState] = useState<HealthState>({ kind: "loading" });

  useEffect(() => {
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<HealthResponse>;
      })
      .then((data) => setState({ kind: "ok", data }))
      .catch((e: unknown) =>
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        }),
      );
  }, []);

  return (
    <main className={styles["app"]} data-testid="app">
      <div className={styles["app-inner"]}>
        <h1 className={styles["app-title"]}>Calendar Planner</h1>
        <p className={styles["app-subtitle"]}>
          Single-user web app for placing plans into Google Calendar.
        </p>

        <Card data-testid="api-status-card" padding="md">
          <Surface data-testid="api-status-surface" as="div">
            <div className={styles["status-row"]}>
              <span>API status:</span>
              {state.kind === "loading" && (
                <span className={styles["status-loading"]} data-testid="status-loading">
                  loading…
                </span>
              )}
              {state.kind === "ok" && (
                <span className={styles["status-ok"]} data-testid="status-ok">
                  {state.data.status}
                </span>
              )}
              {state.kind === "error" && (
                <span className={styles["status-error"]} data-testid="status-error">
                  error: {state.message}
                </span>
              )}
            </div>
          </Surface>
        </Card>
      </div>
    </main>
  );
}
