import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App.js";

describe("App with PlanInput + WeekView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockApiResponses(opts: { parsed?: unknown; busy?: Record<string, Array<{ start: string; end: string }>> } = {}) {
    return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/health") && (!init || init.method === "GET")) {
        return Promise.resolve(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));
      }
      if (url.includes("/api/week")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              week: { start: "2026-07-06T00:00:00.000Z", end: "2026-07-12T23:59:59.999Z" },
              busy: opts.busy ?? {},
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.includes("/api/plan") && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              parsed: opts.parsed ?? {
                title: "Подготовить презентацию",
                durationMinutes: 120,
                type: "focus",
                deadline: null,
                hint: null,
              },
              suggestions: [
                {
                  start: "2026-07-08T09:00:00.000Z",
                  end: "2026-07-08T10:00:00.000Z",
                  score: 0.8,
                  reason: "ср 09:00–10:00, 60 мин (фокус)",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.reject(new Error("unexpected: " + url + " method=" + init?.method));
    });
  }

  it("renders PlanInput and WeekView", async () => {
    vi.stubGlobal("fetch", mockApiResponses());
    render(<App />);

    expect(screen.getByTestId("plan-input")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("week-view")).toBeInTheDocument();
    });
  });

  it("submits a plan and shows the parsed result in the debug panel", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", mockApiResponses());
    render(<App />);

    await waitFor(() => screen.getByTestId("week-view"));

    const textarea = screen.getByRole("textbox", { name: /план/i });
    await user.type(textarea, "подготовить презентацию, 2 часа");
    await user.click(screen.getByRole("button", { name: /suggest/i }));

    await waitFor(() => {
      expect(screen.getByTestId("plan-debug")).toBeInTheDocument();
    });
    expect(screen.getByTestId("plan-debug").textContent).toContain("Подготовить презентацию");
  });

  it("shows an error banner when the API returns an error", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/api/plan") && init?.method === "POST") {
          return Promise.resolve(
            new Response(
              JSON.stringify({ error: "upstream_error", message: "Gemini is down" }),
              { status: 502, headers: { "Content-Type": "application/json" } },
            ),
          );
        }
        if (url.includes("/api/week")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                week: { start: "2026-07-06T00:00:00.000Z", end: "2026-07-12T23:59:59.999Z" },
                busy: {},
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.resolve(new Response("{}", { status: 200 }));
      }),
    );

    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    const textarea = screen.getByRole("textbox", { name: /план/i });
    await user.type(textarea, "test");
    await user.click(screen.getByRole("button", { name: /suggest/i }));

    expect(await screen.findByTestId("plan-error")).toBeInTheDocument();
  });
});
