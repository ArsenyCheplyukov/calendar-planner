import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App.js";

describe("App with ConfirmModal flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildMock(opts: {
    planResponse?: { parsed?: unknown; suggestions?: unknown[] };
    createResponse?: { event?: unknown; status?: number; body?: unknown };
  } = {}) {
    const plan = opts.planResponse ?? {
      parsed: {
        title: "Подготовить презентацию",
        durationMinutes: 60,
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
    };
    return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/week")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              week: { start: "2026-07-06T00:00:00.000Z", end: "2026-07-12T23:59:59.999Z" },
              busy: {},
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.includes("/api/plan") && init?.method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify(plan), { status: 200, headers: { "Content-Type": "application/json" } }),
        );
      }
      if (url.includes("/api/events") && init?.method === "POST") {
        const status = opts.createResponse?.status ?? 200;
        const body =
          opts.createResponse?.body ?? {
            event: opts.createResponse?.event ?? { id: "evt-1", summary: "Created" },
          };
        return Promise.resolve(
          new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
        );
      }
      return Promise.reject(new Error("unexpected: " + url));
    });
  }

  it("opens the ConfirmModal when Place here is clicked, and creates the event on confirm", async () => {
    const user = userEvent.setup();
    const fetchMock = buildMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    // Submit a plan
    const textarea = screen.getByRole("textbox", { name: /план/i });
    await user.type(textarea, "подготовить презентацию");
    await user.click(screen.getByRole("button", { name: /suggest/i }));

    // Wait for suggestions
    await waitFor(() => screen.getByTestId("suggestions-list"));

    // Click Place here on the first suggestion
    await user.click(screen.getAllByRole("button", { name: /place here/i })[0]!);

    // Modal opens with title and time
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("confirm-title-value")).toHaveTextContent("Подготовить презентацию");

    // Confirm
    await user.click(within(dialog).getByRole("button", { name: /создать/i }));

    // Wait for /api/events call
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("/api/events"))).toBe(true);
    });
  });

  it("shows a success toast after the event is created", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", buildMock());
    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    const textarea = screen.getByRole("textbox", { name: /план/i });
    await user.type(textarea, "x");
    await user.click(screen.getByRole("button", { name: /suggest/i }));
    await waitFor(() => screen.getByTestId("suggestions-list"));
    await user.click(screen.getAllByRole("button", { name: /place here/i })[0]!);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /создать/i }));

    expect(await screen.findByTestId("create-toast")).toHaveTextContent(/создано|успешно/i);
  });
});

describe("App week navigation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildWeekNavMock(initialWeekStart = "2026-07-06T00:00:00.000Z") {
    return vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/week")) {
        const startParam = new URL(url, "http://localhost").searchParams.get("start");
        const start = startParam ? `${startParam}T00:00:00.000Z` : initialWeekStart;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              week: { start, end: "2026-07-12T23:59:59.999Z" },
              busy: {},
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.reject(new Error("unexpected: " + url));
    });
  }

  it("navigates to next and previous weeks based on the displayed week", async () => {
    const user = userEvent.setup();
    const fetchMock = buildWeekNavMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    await user.click(screen.getByLabelText(/следующая неделя/i));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("start=2026-07-13"))).toBe(true);
    });

    await user.click(screen.getByLabelText(/предыдущая неделя/i));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("start=2026-07-06"))).toBe(true);
    });
  });
});
