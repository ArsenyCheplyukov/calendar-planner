import { useEffect, useState } from "react";
import type { Preferences } from "@calendar-planner/shared";

export type PreferencesState =
  | { kind: "loading" }
  | { kind: "ready"; bufferMinutes: number }
  | { kind: "error"; message: string };

export function usePreferences(): PreferencesState {
  const [state, setState] = useState<PreferencesState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/preferences")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Preferences;
        if (!cancelled) {
          setState({ kind: "ready", bufferMinutes: data.bufferMinutes });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : String(e);
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
