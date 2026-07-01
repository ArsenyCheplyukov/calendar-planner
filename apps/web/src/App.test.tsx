import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { App } from "./App.js";

describe("App with week grid", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockApiResponses() {
    return vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/api/health")) {
        return Promise.resolve(
          new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
        );
      }
      if (url.includes("/api/week")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              week: {
                start: "2026-07-06T00:00:00.000Z",
                end: "2026-07-12T23:59:59.999Z",
              },
              busy: {
                "2026-07-08": [
                  { start: "2026-07-08T10:00:00Z", end: "2026-07-08T11:00:00Z" },
                ],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.reject(new Error("unexpected: " + url));
    });
  }

  it("renders WeekView and a busy block from the API response", async () => {
    vi.stubGlobal("fetch", mockApiResponses());

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("week-view")).toBeInTheDocument();
    });

    const blocks = await screen.findAllByTestId("busy-block");
    expect(blocks.length).toBeGreaterThan(0);
  });

  it("refetches with ?start= when next/prev/today buttons are clicked", async () => {
    const fetchMock = mockApiResponses();
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    fetchMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /следующая/i }));
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("/api/week?start="))).toBe(true);
    });

    fetchMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /сегодня/i }));
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      // Today should hit /api/week WITHOUT ?start=
      expect(calls.some((u) => u.includes("/api/week") && !u.includes("?start="))).toBe(true);
    });
  });
});
