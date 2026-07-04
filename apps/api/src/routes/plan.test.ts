import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { DEFAULT_PREFERENCES } from "@calendar-planner/shared";
import type { PreferencesStore } from "../infrastructure/preferences/store.js";

const fakeStore = {
  getPreferences: async () => DEFAULT_PREFERENCES,
  updatePreferences: async (partial: Partial<import("@calendar-planner/shared").Preferences>) => ({ ...DEFAULT_PREFERENCES, ...partial }),
} as unknown as PreferencesStore;

describe("POST /api/plan (suggestions)", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env["GOOGLE_REFRESH_TOKEN"] = "1//test";
    process.env["GOOGLE_CLIENT_ID"] = "cid";
    process.env["GOOGLE_CLIENT_SECRET"] = "csecret";
    process.env["GEMINI_API_KEY"] = "gem-test";
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  function mockGeminiAndCalendar(opts: {
    parsed: unknown;
    busy: Record<string, Array<{ start: string; end: string }>>;
  }) {
    return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("generativelanguage.googleapis.com")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    role: "model",
                    parts: [{ text: JSON.stringify({ candidates: [opts.parsed] }) }],
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (url.includes("oauth2.googleapis.com")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }),
            { status: 200 },
          ),
        );
      }
      // freebusy call goes through googleapis (mocked at the route level via factory)
      return Promise.reject(new Error("unexpected fetch: " + url));
    });
  }

  it("returns up to 3 suggestions, each with a score and a Russian reason", async () => {
    const parsed = {
      title: "Подготовить презентацию",
      durationMinutes: 60,
      type: "focus",
      deadline: null,
      hint: null,
    };

    vi.stubGlobal("fetch", mockGeminiAndCalendar({ parsed, busy: {} }));

    const fakeCalendar = {
      freebusy: {
        query: vi.fn().mockResolvedValue({ data: { calendars: {} } }),
      },
      calendarList: {
        list: vi.fn().mockResolvedValue({ data: { items: [] } }),
      },
    };

    const app = await buildApp({ calendarClientFactory: () => fakeCalendar, preferencesStore: fakeStore });
    const res = await app.inject({
      method: "POST",
      url: "/api/plan",
      payload: { text: "подготовить презентацию, час" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { suggestions: Array<{ score: number; reason: string }> };
    expect(body.suggestions).toBeDefined();
    expect(body.suggestions.length).toBeGreaterThan(0);
    expect(body.suggestions.length).toBeLessThanOrEqual(3);
    for (const s of body.suggestions) {
      expect(s.score).toBeGreaterThan(0);
      expect(s.reason).toMatch(/[а-яё]/i);
    }
    await app.close();
  });

  it("returns a candidates array with the selected candidate for a single interpretation", async () => {
    const parsed = {
      title: "Подготовить презентацию",
      durationMinutes: 60,
      type: "focus",
      deadline: null,
      hint: null,
    };

    vi.stubGlobal("fetch", mockGeminiAndCalendar({ parsed, busy: {} }));

    const fakeCalendar = {
      freebusy: {
        query: vi.fn().mockResolvedValue({ data: { calendars: {} } }),
      },
      calendarList: {
        list: vi.fn().mockResolvedValue({ data: { items: [] } }),
      },
    };

    const app = await buildApp({ calendarClientFactory: () => fakeCalendar, preferencesStore: fakeStore });
    const res = await app.inject({
      method: "POST",
      url: "/api/plan",
      payload: { text: "подготовить презентацию, час" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      candidates: Array<{ candidateId: string; rank: number; parsedPlan: unknown; suggestions: unknown[] }>;
      selectedCandidateId: string;
      parsed: unknown;
      suggestions: unknown[];
    };
    expect(body.candidates).toHaveLength(1);
    expect(body.selectedCandidateId).toBe(body.candidates[0]?.candidateId);
    expect(body.candidates[0]?.rank).toBe(1);
    expect(body.candidates[0]?.parsedPlan).toEqual(body.parsed);
    expect(body.candidates[0]?.suggestions).toEqual(body.suggestions);
    await app.close();
  });

  it("returns multiple scored candidates when the parser emits multiple interpretations", async () => {
    const fakeCalendar = {
      freebusy: {
        query: vi.fn().mockResolvedValue({ data: { calendars: {} } }),
      },
      calendarList: {
        list: vi.fn().mockResolvedValue({ data: { items: [] } }),
      },
    };

    const app = await buildApp({
      calendarClientFactory: () => fakeCalendar,
      preferencesStore: fakeStore,
      parsePlanCandidatesFn: async () => [
        {
          title: "Фокус в понедельник",
          durationMinutes: 60,
          type: "focus",
          deadline: null,
          hint: { window: { dayOfWeek: "mon" } },
        },
        {
          title: "Фокус в среду",
          durationMinutes: 60,
          type: "focus",
          deadline: null,
          hint: { window: { dayOfWeek: "wed" } },
        },
      ],
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/plan",
      payload: { text: "ambiguous", startDate: "2026-07-06" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      candidates: Array<{
        candidateId: string;
        rank: number;
        parsedPlan: { title: string };
        suggestions: Array<{ start: string }>;
      }>;
      selectedCandidateId: string;
    };
    expect(body.candidates).toHaveLength(2);
    expect(body.selectedCandidateId).toBe(body.candidates[0]?.candidateId);
    expect(body.candidates[0]?.rank).toBe(1);
    expect(body.candidates[1]?.rank).toBe(2);
    expect(body.candidates[0]?.parsedPlan.title).toBe("Фокус в понедельник");
    expect(body.candidates[1]?.parsedPlan.title).toBe("Фокус в среду");
    expect(body.candidates[0]?.suggestions[0]?.start).toMatch(/2026-07-06/);
    expect(body.candidates[1]?.suggestions[0]?.start).toMatch(/2026-07-08/);
    await app.close();
  });

  it("reserves per-event buffers when parsing includes them", async () => {
    const parsed = {
      title: "Встреча",
      durationMinutes: 60,
      bufferBeforeMinutes: 30,
      bufferAfterMinutes: 0,
      type: "meeting",
      deadline: null,
      hint: null,
    };

    vi.stubGlobal("fetch", mockGeminiAndCalendar({ parsed, busy: {} }));

    const fakeCalendar = {
      freebusy: {
        query: vi.fn().mockResolvedValue({
          data: {
            calendars: {
              primary: {
                busy: [{ start: "2026-07-06T08:30:00Z", end: "2026-07-06T09:00:00Z" }],
              },
            },
          },
        }),
      },
      calendarList: {
        list: vi.fn().mockResolvedValue({ data: { items: [{ id: "primary" }] } }),
      },
    };

    const app = await buildApp({
      calendarClientFactory: () => fakeCalendar,
      getAccessToken: async () => "ya29.test",
      preferencesStore: fakeStore,
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/plan",
      payload: { text: "встреча 1 час с 30 минут до", startDate: "2026-07-06" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { suggestions: Array<{ start: string; end: string }> };
    const monday = body.suggestions.find((s) => s.start.startsWith("2026-07-06"));
    expect(monday).toBeDefined();
    // Without the before-buffer the slot would start at 09:00. With the 30-min
    // event buffer plus the default 15-min preference buffer, the blocked span
    // must clear the expanded 08:15–09:15 busy window, so the first viable start
    // is 09:45.
    expect(monday!.start).toBe("2026-07-06T09:45:00.000Z");
    expect(monday!.end).toBe("2026-07-06T10:45:00.000Z");
    await app.close();
  });

  it("returns a Saturday suggestion when the plan explicitly requests a Saturday", async () => {
    const parsed = {
      title: "Встреча",
      durationMinutes: 60,
      type: "meeting",
      deadline: null,
      hint: { window: { date: "2026-07-04" } },
    };

    vi.stubGlobal("fetch", mockGeminiAndCalendar({ parsed, busy: {} }));

    const fakeCalendar = {
      freebusy: {
        query: vi.fn().mockResolvedValue({ data: { calendars: {} } }),
      },
      calendarList: {
        list: vi.fn().mockResolvedValue({ data: { items: [] } }),
      },
    };

    const app = await buildApp({
      calendarClientFactory: () => fakeCalendar,
      preferencesStore: fakeStore,
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/plan",
      payload: { text: "встреча в субботу", timeZone: "Europe/Moscow" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { suggestions: Array<{ start: string }> };
    expect(body.suggestions.length).toBeGreaterThan(0);
    expect(body.suggestions[0]!.start).toMatch(/^2026-07-04/);
    await app.close();
  });

  it("returns 400 when text is empty", async () => {
    const app = await buildApp({ preferencesStore: fakeStore });
    const res = await app.inject({ method: "POST", url: "/api/plan", payload: { text: "" } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
