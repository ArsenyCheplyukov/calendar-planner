import { useCallback, useEffect, useRef, useState } from "react";
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

type UndoState =
  | { kind: "create"; toastId: number; eventId: string }
  | { kind: "edit"; toastId: number; eventId: string; previous: EventFormData };

export interface UseEventFormDeps {
  fetchWeek: (start: string | null) => Promise<void>;
  startParam: string | null;
  pushToast: (message: string, tone: "success" | "error", action?: { label: string; onClick: () => void }) => number;
  dismissToast: (id: number) => void;
}

export interface UseEventFormReturn {
  eventForm: EventFormState;
  createState: CreateState;
  openManualForm: () => void;
  openSuggestionForm: (suggestion: Suggestion, parsedPlan: ParsedPlan, originalPlanText: string) => void;
  openEditForm: (eventId: string, event: EventFormData) => void;
  handleFormCancel: () => void;
  handleFormSubmit: (data: EventFormData) => Promise<void>;
  cancelUndo: () => void;
}

const UNDO_DURATION_MS = 5000;

export function useEventForm(deps: UseEventFormDeps): UseEventFormReturn {
  const { fetchWeek, startParam, pushToast, dismissToast } = deps;
  const [eventForm, setEventForm] = useState<EventFormState>({ kind: "closed" });
  const [createState, setCreateState] = useState<CreateState>({ kind: "idle" });
  const [undo, setUndo] = useState<UndoState | null>(null);
  const undoRef = useRef<UndoState | null>(null);

  useEffect(() => {
    undoRef.current = undo;
  }, [undo]);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => {
      dismissToast(undo.toastId);
      setUndo(null);
    }, UNDO_DURATION_MS);
    return () => clearTimeout(timer);
  }, [undo, dismissToast]);

  useEffect(() => {
    if (!undo) return;
    dismissToast(undo.toastId);
    setUndo(null);
  }, [startParam]);

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

  const cancelUndo = useCallback(() => {
    if (undoRef.current) {
      dismissToast(undoRef.current.toastId);
      setUndo(null);
    }
  }, [dismissToast]);

  const performUndo = useCallback(async () => {
    const current = undoRef.current;
    if (!current) return;

    if (current.kind === "create") {
      try {
        const res = await fetch(`/api/events/${current.eventId}`, { method: "DELETE" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? `HTTP ${res.status}`);
        }
        pushToast("Создание отменено", "success");
        setUndo(null);
        void fetchWeek(startParam);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        pushToast(`Не удалось отменить создание: ${message}`, "error");
      }
      return;
    }

    try {
      const res = await fetch(`/api/events/${current.eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot: { start: current.previous.start, end: current.previous.end },
          title: current.previous.title,
          description: current.previous.description,
          location: current.previous.location,
          type: current.previous.type,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      pushToast("Изменения отменены", "success");
      setUndo(null);
      void fetchWeek(startParam);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      pushToast(`Не удалось отменить изменения: ${message}`, "error");
    }
  }, [fetchWeek, pushToast, startParam]);

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
      const previousValues = isEdit ? eventForm.event : undefined;

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

        if (undoRef.current) {
          dismissToast(undoRef.current.toastId);
        }

        const action = { label: "Undo", onClick: performUndo };
        const toastMessage = isEdit ? "Событие обновлено" : "Событие создано";
        const toastId = pushToast(toastMessage, "success", action);

        const resBody = (await res.json().catch(() => ({}))) as { event?: { id?: string } };
        const eventId = resBody.event?.id ?? (isEdit ? eventForm.eventId : undefined);
        if (eventId) {
          if (isEdit && previousValues) {
            setUndo({ kind: "edit", toastId, eventId, previous: previousValues });
          } else {
            setUndo({ kind: "create", toastId, eventId });
          }
        }

        setEventForm({ kind: "closed" });
        setCreateState({ kind: "idle" });
        void fetchWeek(startParam);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setCreateState({ kind: "error", message });
        pushToast(`Не удалось: ${message}`, "error");
      }
    },
    [eventForm, pushToast, fetchWeek, startParam, dismissToast, performUndo],
  );

  return {
    eventForm,
    createState,
    openManualForm,
    openSuggestionForm,
    openEditForm,
    handleFormCancel,
    handleFormSubmit,
    cancelUndo,
  };
}
