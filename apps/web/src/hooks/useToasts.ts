import { useCallback, useState } from "react";

export type Toast = {
  id: number;
  message: string;
  tone: "success" | "error";
  action?: { label: string; onClick: () => void };
};

export interface UseToastsReturn {
  toasts: Toast[];
  pushToast: (message: string, tone: Toast["tone"], action?: Toast["action"]) => number;
  dismissToast: (id: number) => void;
}

const TOAST_DURATION_MS = 5000;

export function useToasts(): UseToastsReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, tone: Toast["tone"], action?: Toast["action"]) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, message, tone, action }]);
      setTimeout(() => {
        dismissToast(id);
      }, TOAST_DURATION_MS);
      return id;
    },
    [dismissToast],
  );

  return { toasts, pushToast, dismissToast };
}
