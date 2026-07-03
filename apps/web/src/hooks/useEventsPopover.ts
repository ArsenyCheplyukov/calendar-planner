import { useCallback, useState } from "react";
import type { EventItem } from "../components/EventsPopover/index.js";

export type EventsPopoverState =
  | { kind: "loading"; windowStart: string; windowEnd: string }
  | { kind: "ready"; windowStart: string; windowEnd: string; events: EventItem[] }
  | { kind: "error"; windowStart: string; windowEnd: string; message: string };

export interface UseEventsPopoverReturn {
  eventsState: EventsPopoverState | null;
  handleBlockClick: (busySlot: { start: string; end: string }) => Promise<void>;
  handlePopoverClose: () => void;
}

export function useEventsPopover(): UseEventsPopoverReturn {
  const [eventsState, setEventsState] = useState<EventsPopoverState | null>(null);

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

  return { eventsState, handleBlockClick, handlePopoverClose };
}
