import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App.js";
import type { BusyMap, Suggestion } from "@calendar-planner/shared";

describe("App event creation flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildMock(opts: {
    planResponse?: { parsed?: unknown; suggestions?: unknown[] };
    createResponse?: { event?: unknown; status?: number; body?: unknown };
    eventsResponse?: { events?: unknown[]; status?: number; body?: unknown };
    patchResponse?: { event?: unknown; status?: number; body?: unknown };
    weekBusy?: BusyMap;
    bufferMinutes?: number;
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
    const busy = opts.weekBusy ?? {};
    const bufferMinutes = opts.bufferMinutes ?? 15;
    return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/week")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              week: { start: "2026-07-06T00:00:00.000Z", end: "2026-07-12T23:59:59.999Z" },
              busy,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.includes("/api/preferences")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ bufferMinutes }),
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
      if (url.includes("/api/events/") && init?.method === "DELETE") {
        const id = url.split("/").pop();
        return Promise.resolve(
          new Response(JSON.stringify({ id }), { status: 200, headers: { "Content-Type": "application/json" } }),
        );
      }
      if (url.includes("/api/events?") && (!init || init.method === undefined || init.method === "GET")) {
        const status = opts.eventsResponse?.status ?? 200;
        const body =
          opts.eventsResponse?.body ?? {
            events: opts.eventsResponse?.events ?? [],
          };
        return Promise.resolve(
          new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
        );
      }
      if (url.includes("/api/events/") && init?.method === "PATCH") {
        const status = opts.patchResponse?.status ?? 200;
        const body =
          opts.patchResponse?.body ?? {
            event: opts.patchResponse?.event ?? { id: url.split("/").pop(), summary: "Updated" },
          };
        return Promise.resolve(
          new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
        );
      }
      return Promise.reject(new Error("unexpected: " + url));
    });
  }

  it("opens the event form when Add event is clicked on a suggestion, and creates the event on submit", async () => {
    const user = userEvent.setup();
    const fetchMock = buildMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    const textarea = screen.getByRole("textbox", { name: /план/i });
    await user.type(textarea, "подготовить презентацию");
    await user.click(screen.getByRole("button", { name: /suggest/i }));

    await waitFor(() => screen.getByTestId("plan-candidates"));
    await user.click(screen.getAllByRole("button", { name: /add event/i })[0]!);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/title/i)).toHaveValue("Подготовить презентацию");

    await user.click(within(dialog).getByRole("button", { name: /create event/i }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("/api/events"))).toBe(true);
    });

    const eventCall = fetchMock.mock.calls.find(
      (c) => String(c[0]).includes("/api/events") && (c[1] as RequestInit | undefined)?.method === "POST",
    );
    const body = JSON.parse((eventCall?.[1] as RequestInit).body as string) as {
      title?: string;
      parsedPlan?: { title: string };
      originalPlanText?: string;
    };
    expect(body.title).toBe("Подготовить презентацию");
    expect(body.parsedPlan?.title).toBe("Подготовить презентацию");
    expect(body.originalPlanText).toBe("подготовить презентацию");
  });

  it("shows a success toast after the event is created", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", buildMock());
    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    const textarea = screen.getByRole("textbox", { name: /план/i });
    await user.type(textarea, "x");
    await user.click(screen.getByRole("button", { name: /suggest/i }));
    await waitFor(() => screen.getByTestId("plan-candidates"));
    await user.click(screen.getAllByRole("button", { name: /add event/i })[0]!);

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /create event/i }));

    expect(await screen.findByTestId("create-toast")).toHaveTextContent(/создано|успешно/i);
  });

  it("offers an undo action after creating an event and deletes it on click", async () => {
    const user = userEvent.setup();
    const fetchMock = buildMock({ createResponse: { event: { id: "evt-new", summary: "Created" } } });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    const textarea = screen.getByRole("textbox", { name: /план/i });
    await user.type(textarea, "x");
    await user.click(screen.getByRole("button", { name: /suggest/i }));
    await waitFor(() => screen.getByTestId("plan-candidates"));
    await user.click(screen.getAllByRole("button", { name: /add event/i })[0]!);

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /create event/i }));

    const toast = await screen.findByTestId("create-toast");
    const undoButton = within(toast).getByRole("button", { name: /undo/i });
    await user.click(undoButton);

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(
        (c) => String(c[0]).includes("/api/events/evt-new") && (c[1] as RequestInit | undefined)?.method === "DELETE",
      );
      expect(deleteCall).toBeDefined();
    });
  });

  it("offers an undo action after editing an event and reverts it on click", async () => {
    const user = userEvent.setup();
    const originalEvent = {
      id: "evt-edit",
      summary: "Original title",
      start: "2026-07-08T09:00:00.000Z",
      end: "2026-07-08T10:00:00.000Z",
      type: "meeting",
    };
    const busy: BusyMap = {
      "2026-07-08": [{ start: "2026-07-08T09:00:00.000Z", end: "2026-07-08T10:00:00.000Z" }],
    };
    const fetchMock = buildMock({
      weekBusy: busy,
      eventsResponse: { events: [originalEvent] },
      patchResponse: { event: { id: "evt-edit", summary: "Updated title" } },
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    await user.click(screen.getAllByTestId("busy-block")[0]!);
    await waitFor(() => screen.getByTestId("edit-event-button"));
    await user.click(screen.getByTestId("edit-event-button"));

    const dialog = await screen.findByRole("dialog");
    const titleInput = within(dialog).getByLabelText(/title/i);
    await user.clear(titleInput);
    await user.type(titleInput, "Updated title");
    await user.click(within(dialog).getByRole("button", { name: /save changes/i }));

    const toast = await screen.findByTestId("create-toast");
    const undoButton = within(toast).getByRole("button", { name: /undo/i });
    await user.click(undoButton);

    await waitFor(() => {
      const undoPatchCall = fetchMock.mock.calls.find(
        (c) =>
          String(c[0]).includes("/api/events/evt-edit") &&
          (c[1] as RequestInit | undefined)?.method === "PATCH" &&
          ((c[1] as RequestInit).body as string).includes("Original title"),
      );
      expect(undoPatchCall).toBeDefined();
    });
  });

  it("cancels the undo opportunity when navigating to another week", async () => {
    const user = userEvent.setup();
    const fetchMock = buildMock({ createResponse: { event: { id: "evt-nav", summary: "Created" } } });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    const textarea = screen.getByRole("textbox", { name: /план/i });
    await user.type(textarea, "x");
    await user.click(screen.getByRole("button", { name: /suggest/i }));
    await waitFor(() => screen.getByTestId("plan-candidates"));
    await user.click(screen.getAllByRole("button", { name: /add event/i })[0]!);

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /create event/i }));

    await screen.findByTestId("create-toast");

    await user.click(screen.getByRole("button", { name: /следующая/i }));

    await waitFor(() => {
      expect(screen.queryByTestId("create-toast")).not.toBeInTheDocument();
    });

    const deleteCall = fetchMock.mock.calls.find(
      (c) => String(c[0]).includes("/api/events/evt-nav") && (c[1] as RequestInit | undefined)?.method === "DELETE",
    );
    expect(deleteCall).toBeUndefined();
  });

  it("creates an event manually through the event form", async () => {
    const user = userEvent.setup();
    const fetchMock = buildMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    await user.click(screen.getByTestId("create-event-button"));

    const dialog = await screen.findByRole("dialog");
    const titleInput = within(dialog).getByLabelText(/title/i);
    await user.clear(titleInput);
    await user.type(titleInput, "Ручное событие");

    await user.click(within(dialog).getByRole("button", { name: /create event/i }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("/api/events"))).toBe(true);
    });

    const eventCall = fetchMock.mock.calls.find(
      (c) => String(c[0]).includes("/api/events") && (c[1] as RequestInit | undefined)?.method === "POST",
    );
    const body = JSON.parse((eventCall?.[1] as RequestInit).body as string) as {
      title: string;
      parsedPlan?: unknown;
      originalPlanText?: unknown;
    };
    expect(body.title).toBe("Ручное событие");
    expect(body.parsedPlan).toBeUndefined();
    expect(body.originalPlanText).toBeUndefined();
  });

  it("shows a soft conflict warning in the event form when the slot overlaps a busy block", async () => {
    const user = userEvent.setup();
    const busy: BusyMap = {
      "2026-07-08": [{ start: "2026-07-08T08:00:00.000Z", end: "2026-07-08T09:30:00.000Z" }],
    };
    vi.stubGlobal("fetch", buildMock({ weekBusy: busy, bufferMinutes: 0 }));

    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    const textarea = screen.getByRole("textbox", { name: /план/i });
    await user.type(textarea, "подготовить презентацию");
    await user.click(screen.getByRole("button", { name: /suggest/i }));

    await waitFor(() => screen.getByTestId("plan-candidates"));
    await user.click(screen.getAllByRole("button", { name: /add event/i })[0]!);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("conflict-warning")).toHaveTextContent(/overlaps with a busy block/i);
  });

  it("renders a 'No clean slots found' banner when every active candidate suggestion conflicts", async () => {
    const user = userEvent.setup();
    const busy: BusyMap = {
      "2026-07-08": [{ start: "2026-07-08T08:00:00.000Z", end: "2026-07-08T11:00:00.000Z" }],
      "2026-07-09": [{ start: "2026-07-09T08:00:00.000Z", end: "2026-07-09T11:00:00.000Z" }],
    };
    vi.stubGlobal(
      "fetch",
      buildMock({
        weekBusy: busy,
        bufferMinutes: 0,
        planResponse: {
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
            {
              start: "2026-07-09T09:00:00.000Z",
              end: "2026-07-09T10:00:00.000Z",
              score: 0.7,
              reason: "чт 09:00–10:00, 60 мин (фокус)",
            },
          ],
        },
      }),
    );

    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    const textarea = screen.getByRole("textbox", { name: /план/i });
    await user.type(textarea, "подготовить презентацию");
    await user.click(screen.getByRole("button", { name: /suggest/i }));

    await waitFor(() => screen.getByTestId("suggestions-list"));
    expect(screen.getByTestId("no-clean-slots")).toHaveTextContent(/no clean slots found/i);
  });
});

  it("switches suggestions when a different candidate is selected", async () => {
    const user = userEvent.setup();
    const candidate1 = {
      candidateId: "candidate-1",
      rank: 1,
      parsedPlan: {
        title: "Фокус в понедельник",
        durationMinutes: 60,
        type: "focus",
        deadline: null,
        hint: { window: { dayOfWeek: "mon" } },
      },
      suggestions: [
        {
          start: "2026-07-06T09:00:00.000Z",
          end: "2026-07-06T10:00:00.000Z",
          score: 0.8,
          reason: "пн 09:00–10:00, 60 мин (фокус)",
        },
      ],
    };
    const candidate2 = {
      candidateId: "candidate-2",
      rank: 2,
      parsedPlan: {
        title: "Фокус в среду",
        durationMinutes: 60,
        type: "focus",
        deadline: null,
        hint: { window: { dayOfWeek: "wed" } },
      },
      suggestions: [
        {
          start: "2026-07-08T09:00:00.000Z",
          end: "2026-07-08T10:00:00.000Z",
          score: 0.75,
          reason: "ср 09:00–10:00, 60 мин (фокус)",
        },
      ],
    };

    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
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
          new Response(
            JSON.stringify({
              candidates: [candidate1, candidate2],
              selectedCandidateId: candidate1.candidateId,
              parsed: candidate1.parsedPlan,
              suggestions: candidate1.suggestions,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.reject(new Error("unexpected: " + url));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    const textarea = screen.getByRole("textbox", { name: /план/i });
    await user.type(textarea, "подготовить презентацию");
    await user.click(screen.getByRole("button", { name: /suggest/i }));

    await waitFor(() => screen.getByTestId("plan-candidates"));
    expect(screen.getAllByTestId("plan-candidate-card")).toHaveLength(2);
    expect(screen.getByTestId("plan-candidates")).toHaveTextContent(/пн 09:00/);

    await user.click(screen.getAllByTestId("plan-candidate-card")[1]!);

    await waitFor(() => {
      expect(screen.getByTestId("plan-candidates")).toHaveTextContent(/ср 09:00/);
    });
  });

  it("renders suggestions when the API returns the new candidate response shape", async () => {
    const user = userEvent.setup();
    const parsedPlan = {
      title: "Подготовить презентацию",
      durationMinutes: 60,
      type: "focus",
      deadline: null,
      hint: null,
    };
    const suggestions = [
      {
        start: "2026-07-08T09:00:00.000Z",
        end: "2026-07-08T10:00:00.000Z",
        score: 0.8,
        reason: "ср 09:00–10:00, 60 мин (фокус)",
      },
    ];
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
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
          new Response(
            JSON.stringify({
              candidates: [
                {
                  candidateId: "candidate-1",
                  rank: 1,
                  parsedPlan,
                  suggestions,
                },
              ],
              selectedCandidateId: "candidate-1",
              parsed: parsedPlan,
              suggestions,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.reject(new Error("unexpected: " + url));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    const textarea = screen.getByRole("textbox", { name: /план/i });
    await user.type(textarea, "подготовить презентацию");
    await user.click(screen.getByRole("button", { name: /suggest/i }));

    await waitFor(() => screen.getByTestId("plan-candidates"));
    expect(screen.getAllByTestId("plan-candidate-card")).toHaveLength(1);
  });

describe("App regenerate flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fills the plan textarea with the previous plan and resubmits with extra instructions", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
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
          new Response(
            JSON.stringify({
              parsed: {
                title: "Встреча",
                durationMinutes: 60,
                type: "meeting",
                deadline: null,
                hint: null,
              },
              suggestions: [
                {
                  start: "2026-07-08T09:00:00.000Z",
                  end: "2026-07-08T10:00:00.000Z",
                  score: 0.8,
                  reason: "ср 09:00–10:00, 60 мин (митинг)",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.reject(new Error("unexpected: " + url));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    const textarea = screen.getByRole("textbox", { name: /план/i });
    await user.type(textarea, "встреча с клиентом");
    await user.click(screen.getByRole("button", { name: /suggest/i }));

    await waitFor(() => screen.getByTestId("plan-candidates"));

    await user.click(screen.getByTestId("regenerate-button"));
    expect(textarea).toHaveValue("встреча с клиентом");

    await user.type(textarea, " утром");
    await user.click(screen.getByRole("button", { name: /suggest/i }));

    await waitFor(() => {
      const planCalls = fetchMock.mock.calls.filter(
        (c) => String(c[0]).includes("/api/plan") && (c[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(planCalls.length).toBeGreaterThanOrEqual(2);
      const lastBody = JSON.parse((planCalls[planCalls.length - 1]![1] as RequestInit).body as string) as {
        text: string;
      };
      expect(lastBody.text).toContain("встреча с клиентом");
      expect(lastBody.text).toContain("утром");
    });
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

describe("App bulk create flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildBulkMock(opts: {
    suggestions: Suggestion[];
    postResponses?: { status: number; body?: unknown }[];
  }) {
    let postIndex = 0;
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
      if (url.includes("/api/preferences")) {
        return Promise.resolve(
          new Response(JSON.stringify({ bufferMinutes: 15 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url.includes("/api/plan") && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              parsed: {
                title: "Bulk plan",
                durationMinutes: 60,
                type: "focus",
                deadline: null,
                hint: null,
              },
              suggestions: opts.suggestions,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.includes("/api/events") && init?.method === "POST") {
        const response = opts.postResponses?.[postIndex++] ?? {
          status: 200,
          body: { event: { id: `evt-${postIndex}`, summary: "Created" } },
        };
        return Promise.resolve(
          new Response(JSON.stringify(response.body ?? {}), {
            status: response.status,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.reject(new Error("unexpected: " + url));
    });
  }

  it("creates an event for each selected suggestion", async () => {
    const user = userEvent.setup();
    const suggestions: Suggestion[] = [
      {
        start: "2026-07-08T09:00:00.000Z",
        end: "2026-07-08T10:00:00.000Z",
        score: 0.8,
        reason: "ср 09:00–10:00",
      },
      {
        start: "2026-07-09T10:00:00.000Z",
        end: "2026-07-09T11:00:00.000Z",
        score: 0.7,
        reason: "чт 10:00–11:00",
      },
    ];
    const fetchMock = buildBulkMock({ suggestions });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    const textarea = screen.getByRole("textbox", { name: /план/i });
    await user.type(textarea, "bulk plan");
    await user.click(screen.getByRole("button", { name: /suggest/i }));
    await waitFor(() => screen.getByTestId("suggestions-list"));

    const checkboxes = screen.getAllByTestId("suggestion-checkbox");
    await user.click(checkboxes[0]!);
    await user.click(checkboxes[1]!);

    await user.click(screen.getByRole("button", { name: /create selected/i }));

    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(
        (c) => String(c[0]).includes("/api/events") && (c[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(postCalls).toHaveLength(2);
      const bodies = postCalls.map(
        (c) => JSON.parse((c[1] as RequestInit).body as string) as { slot?: { start: string; end: string } },
      );
      expect(bodies[0]?.slot?.start).toBe("2026-07-08T09:00:00.000Z");
      expect(bodies[1]?.slot?.start).toBe("2026-07-09T10:00:00.000Z");
    });

    const toast = await screen.findByTestId("create-toast");
    expect(toast).toHaveTextContent(/created 2 events/i);
  });

  it("continues bulk creation and reports failures when one event fails", async () => {
    const user = userEvent.setup();
    const suggestions: Suggestion[] = [
      {
        start: "2026-07-08T09:00:00.000Z",
        end: "2026-07-08T10:00:00.000Z",
        score: 0.8,
        reason: "ср 09:00–10:00",
      },
      {
        start: "2026-07-09T10:00:00.000Z",
        end: "2026-07-09T11:00:00.000Z",
        score: 0.7,
        reason: "чт 10:00–11:00",
      },
    ];
    const fetchMock = buildBulkMock({
      suggestions,
      postResponses: [
        { status: 500, body: { message: "Upstream error" } },
        { status: 200, body: { event: { id: "evt-ok", summary: "Created" } } },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await waitFor(() => screen.getByTestId("week-view"));

    const textarea = screen.getByRole("textbox", { name: /план/i });
    await user.type(textarea, "bulk plan");
    await user.click(screen.getByRole("button", { name: /suggest/i }));
    await waitFor(() => screen.getByTestId("suggestions-list"));

    const checkboxes = screen.getAllByTestId("suggestion-checkbox");
    await user.click(checkboxes[0]!);
    await user.click(checkboxes[1]!);

    await user.click(screen.getByRole("button", { name: /create selected/i }));

    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(
        (c) => String(c[0]).includes("/api/events") && (c[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(postCalls).toHaveLength(2);
    });

    const toast = await screen.findByTestId("create-toast");
    expect(toast).toHaveTextContent(/created 1 of 2/i);
    expect(toast).toHaveTextContent(/upstream error/i);
  });
});
