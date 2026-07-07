import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCalendarEvents } from "./useCalendarEvents.js";

describe("useCalendarEvents", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts ready with no events when range is missing", () => {
    vi.stubGlobal("fetch", vi.fn());
    const { result } = renderHook(() => useCalendarEvents({}));
    expect(result.current.state.kind).toBe("ready");
    if (result.current.state.kind === "ready") {
      expect(result.current.state.events).toEqual([]);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches events for the given range", async () => {
    const events = [
      {
        id: "evt-1",
        summary: "Standup",
        start: "2026-07-08T09:00:00Z",
        end: "2026-07-08T09:30:00Z",
        allDay: false,
        type: "meeting",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ events }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useCalendarEvents({
        from: "2026-07-06T00:00:00Z",
        to: "2026-07-12T23:59:59Z",
      }),
    );

    await waitFor(() => expect(result.current.state.kind).toBe("ready"));

    if (result.current.state.kind === "ready") {
      expect(result.current.state.events).toHaveLength(1);
      expect(result.current.state.events[0]?.id).toBe("evt-1");
    }

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/api/events?");
    expect(url).toContain("from=2026-07-06T00%3A00%3A00Z");
    expect(url).toContain("to=2026-07-12T23%3A59%3A59Z");
  });

  it("reports an error when the request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "upstream error" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useCalendarEvents({
        from: "2026-07-06T00:00:00Z",
        to: "2026-07-12T23:59:59Z",
      }),
    );

    await waitFor(() => expect(result.current.state.kind).toBe("error"));

    if (result.current.state.kind === "error") {
      expect(result.current.state.message).toContain("upstream error");
    }
  });
});
