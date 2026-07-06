import { useCallback, useState } from "react";
import type { Suggestion, ParsedPlan } from "@calendar-planner/shared";
import type { EventFormData } from "../components/EventForm/index.js";

export type EventFormState =
  | { kind: "closed" }
  | { kind: "manual" }
  | { kind: "suggestion"; suggestion: Suggestion; parsedPlan: ParsedPlan; originalPlanText: string }
  | { kind: "edit"; eventId: string; event: EventFormData };

export type CreateState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

export interface UseEventFormDeps {
  fetchWeek: (start: string | null) => Promise<void>;
  startParam: string | null;
  pushToast: (message: string, tone: "success" | "error") => void;
}

export interface UseEventFormReturn {
  eventForm: EventFormState;
  createState: CreateState;
  openManualForm: () => void;
  openSuggestionForm: (suggestion: Suggestion, parsedPlan: ParsedPlan, originalPlanText: string) => void;
  openEditForm: (eventId: string, event: EventFormData) => void;
  handleFormCancel: () => void;
  handleFormSubmit: (data: EventFormData) => Promise<void>;
}

export function useEventForm(deps: UseEventFormDeps): UseEventFormReturn {
  const { fetchWeek, startParam, pushToast } = deps;
  const [eventForm, setEventForm] = useState<EventFormState>({ kind: "closed" });
  const [createState, setCreateState] = useState<CreateState>({ kind: "idle" });

  const openManualForm = useCallback(() => {
    setCreateState({ kind: "idle" });
    setEventForm({ kind: "manual" });
  }, []);

  const openSuggestionForm = useCallback((
    suggestion: Suggestion,
    parsedPlan: ParsedPlan,
    originalPlanText: string,
  ) => {
    setCreateState({ kind: "idle" });
    setEventForm({
      kind: "suggestion",
      suggestion,
      parsedPlan,
      originalPlanText,
    });
  }, []);

  const openEditForm = useCallback((eventId: string, event: EventFormData) => {
    setCreateState({ kind: "idle" });
    setEventForm({ kind: "edit", eventId, event });
  }, []);

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
        type: data.type,
      };

      const isEdit = eventForm.kind === "edit";
      const url = isEdit ? `/api/events/${eventForm.eventId}` : "/api/events";
      const method = isEdit ? "PATCH" : "POST";

      if (eventForm.kind === "suggestion") {
        body.parsedPlan = eventForm.parsedPlan;
        body.originalPlanText = eventForm.originalPlanText;
      }

      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const resBody = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(resBody.message ?? `HTTP ${res.status}`);
        }
        pushToast(isEdit ? "Событие обновлено" : "Событие создано", "success");
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

  return {
    eventForm,
    createState,
    openManualForm,
    openSuggestionForm,
    openEditForm,
    handleFormCancel,
    handleFormSubmit,
  };
}
