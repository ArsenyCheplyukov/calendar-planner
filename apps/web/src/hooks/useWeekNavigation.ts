import { useCallback, useEffect, useState } from "react";
import {
  getLocalTimeZone,
  ymdInTimeZone,
  parseYmdInTimeZone,
  addDaysInTimeZone,
} from "@calendar-planner/shared";
import type { BusyMap } from "@calendar-planner/shared";
import type { WeekViewWeek } from "../components/WeekView/index.js";

type WeekResponse = {
  week: WeekViewWeek;
  busy: BusyMap;
};

export type WeekState =
  | { kind: "loading" }
  | { kind: "ready"; data: WeekResponse }
  | { kind: "error"; message: string };

function todayYmd(): string {
  return ymdInTimeZone(getLocalTimeZone(), new Date());
}

function isoToYmdInTimeZone(iso: string, timeZone: string): string {
  return ymdInTimeZone(timeZone, new Date(iso));
}

function addDaysToYmd(ymd: string, days: number, timeZone: string): string {
  const parsed = parseYmdInTimeZone(timeZone, ymd);
  if (!parsed) return ymd;
  return ymdInTimeZone(timeZone, addDaysInTimeZone(timeZone, parsed, days));
}

function buildWeekUrl(start: string | null): string {
  const tz = encodeURIComponent(getLocalTimeZone());
  if (start) {
    return `/api/week?start=${start}&timeZone=${tz}`;
  }
  return `/api/week?timeZone=${tz}`;
}

export interface UseWeekNavigationReturn {
  weekState: WeekState;
  startParam: string | null;
  fetchWeek: (start: string | null) => Promise<void>;
  handlePrev: () => void;
  handleNext: () => void;
  handleToday: () => void;
}

export function useWeekNavigation(): UseWeekNavigationReturn {
  const [weekState, setWeekState] = useState<WeekState>({ kind: "loading" });
  const [startParam, setStartParam] = useState<string | null>(null);

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

  const handlePrev = useCallback(() => {
    setStartParam((current) => {
      const tz = getLocalTimeZone();
      const base =
        current ??
        (weekState.kind === "ready"
          ? isoToYmdInTimeZone(weekState.data.week.start, tz)
          : todayYmd());
      return addDaysToYmd(base, -7, tz);
    });
  }, [weekState]);

  const handleNext = useCallback(() => {
    setStartParam((current) => {
      const tz = getLocalTimeZone();
      const base =
        current ??
        (weekState.kind === "ready"
          ? isoToYmdInTimeZone(weekState.data.week.start, tz)
          : todayYmd());
      return addDaysToYmd(base, 7, tz);
    });
  }, [weekState]);

  const handleToday = useCallback(() => {
    setStartParam(null);
  }, []);

  return { weekState, startParam, fetchWeek, handlePrev, handleNext, handleToday };
}
