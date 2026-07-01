import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { DEFAULT_PREFERENCES } from "../domain/scorer.js";
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
                  content: { role: "model", parts: [{ text: JSON.stringify(opts.parsed) }] },
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

  it("returns 400 when text is empty", async () => {
    const app = await buildApp({ preferencesStore: fakeStore });
    const res = await app.inject({ method: "POST", url: "/api/plan", payload: { text: "" } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
