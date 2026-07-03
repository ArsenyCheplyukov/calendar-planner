import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useWeekNavigation } from "./useWeekNavigation.js";

vi.mock("@calendar-planner/shared", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@calendar-planner/shared")>();
  return {
    ...mod,
    getLocalTimeZone: () => "Europe/London",
  };
});

describe("useWeekNavigation", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-07-08T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockWeekResponse(start = "2026-07-06T00:00:00.000Z") {
    return vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/week")) {
        const startParam = new URL(url, "http://localhost").searchParams.get("start");
        const resolvedStart = startParam ? `${startParam}T00:00:00.000Z` : start;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              week: { start: resolvedStart, end: "2026-07-12T23:59:59.999Z" },
              busy: {},
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.reject(new Error("unexpected: " + url));
    });
  }

  it("starts loading and becomes ready after fetching the current week", async () => {
    vi.stubGlobal("fetch", mockWeekResponse());

    const { result } = renderHook(() => useWeekNavigation());

    expect(result.current.weekState.kind).toBe("loading");
    await waitFor(() => expect(result.current.weekState.kind).toBe("ready"));
    if (result.current.weekState.kind === "ready") {
      expect(result.current.weekState.data.week.start).toBe("2026-07-06T00:00:00.000Z");
    }
  });

  it("navigates to the next and previous weeks", async () => {
    vi.stubGlobal("fetch", mockWeekResponse());

    const { result } = renderHook(() => useWeekNavigation());
    await waitFor(() => expect(result.current.weekState.kind).toBe("ready"));

    act(() => {
      result.current.handleNext();
    });
    await waitFor(() => {
      const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls as [string][];
      expect(calls.some(([url]) => url.includes("start=2026-07-13"))).toBe(true);
    });

    act(() => {
      result.current.handlePrev();
    });
    await waitFor(() => {
      const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls as [string][];
      expect(calls.some(([url]) => url.includes("start=2026-07-06"))).toBe(true);
    });
  });

  it("returns to today when handleToday is called", async () => {
    vi.stubGlobal("fetch", mockWeekResponse());

    const { result } = renderHook(() => useWeekNavigation());
    await waitFor(() => expect(result.current.weekState.kind).toBe("ready"));

    act(() => {
      result.current.handleNext();
    });
    await waitFor(() => expect(result.current.startParam).not.toBeNull());

    act(() => {
      result.current.handleToday();
    });
    expect(result.current.startParam).toBeNull();
  });

  it("navigates using time-zone-aware week arithmetic across a DST boundary", async () => {
    vi.setSystemTime(new Date("2026-03-23T12:00:00.000Z"));
    vi.stubGlobal("fetch", mockWeekResponse("2026-03-23T00:00:00.000Z"));

    const { result } = renderHook(() => useWeekNavigation());
    await waitFor(() => expect(result.current.weekState.kind).toBe("ready"));

    act(() => {
      result.current.handleNext();
    });
    await waitFor(() => {
      const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls as [string][];
      expect(calls.some(([url]) => url.includes("start=2026-03-30"))).toBe(true);
    });
  });
});
