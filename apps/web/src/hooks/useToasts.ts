import { useCallback, useState } from "react";

export type Toast = { id: number; message: string; tone: "success" | "error" };

export interface UseToastsReturn {
  toasts: Toast[];
  pushToast: (message: string, tone: Toast["tone"]) => void;
}

export function useToasts(): UseToastsReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((message: string, tone: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  return { toasts, pushToast };
}
