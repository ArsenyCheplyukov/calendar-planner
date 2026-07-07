import { useCallback, useEffect, useState } from "react";
import type { CalendarEvent } from "@calendar-planner/shared";

export type CalendarEventsState =
  | { kind: "loading" }
  | { kind: "ready"; events: CalendarEvent[] }
  | { kind: "error"; message: string };

export interface UseCalendarEventsOptions {
  from?: string;
  to?: string;
}

export interface UseCalendarEventsReturn {
  state: CalendarEventsState;
  refetch: () => Promise<void>;
}

export function useCalendarEvents({
  from,
  to,
}: UseCalendarEventsOptions): UseCalendarEventsReturn {
  const [state, setState] = useState<CalendarEventsState>({ kind: "loading" });

  const refetch = useCallback(async () => {
    if (!from || !to) {
      setState({ kind: "ready", events: [] });
      return;
    }

    setState({ kind: "loading" });
    try {
      const res = await fetch(
        `/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      if (res.status === 401) {
        throw new Error("Не авторизован. Запустите pnpm auth.");
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { events: CalendarEvent[] };
      setState({ kind: "ready", events: body.events });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, [from, to]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { state, refetch };
}
