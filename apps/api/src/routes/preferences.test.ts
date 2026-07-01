import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { DEFAULT_PREFERENCES } from "../domain/scorer.js";
import type { PreferencesStore } from "../infrastructure/preferences/store.js";

function makeFakeStore(initial: Partial<import("@calendar-planner/shared").Preferences> | null = null): PreferencesStore {
  let stored = initial;
  return {
    getPreferences: async () => ({ ...DEFAULT_PREFERENCES, ...(stored ?? {}) }),
    updatePreferences: async (partial: Partial<import("@calendar-planner/shared").Preferences>) => {
      stored = { ...(stored ?? DEFAULT_PREFERENCES), ...partial };
      return { ...DEFAULT_PREFERENCES, ...stored };
    },
  } as unknown as PreferencesStore;
}

describe("GET /api/preferences", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns DEFAULT_PREFERENCES when no row exists", async () => {
    const store = makeFakeStore(null);
    const app = await buildApp({ preferencesStore: store });
    const res = await app.inject({ method: "GET", url: "/api/preferences" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(DEFAULT_PREFERENCES);
    await app.close();
  });

  it("returns stored values when present", async () => {
    const store = makeFakeStore({
      workingHoursStart: "10:00",
      bufferMinutes: 30,
    });
    const app = await buildApp({ preferencesStore: store });
    const res = await app.inject({ method: "GET", url: "/api/preferences" });
    const body = res.json() as { workingHoursStart: string; bufferMinutes: number };
    expect(body.workingHoursStart).toBe("10:00");
    expect(body.bufferMinutes).toBe(30);
    await app.close();
  });
});

describe("PUT /api/preferences", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("merges partial and returns the updated Preferences", async () => {
    const store = makeFakeStore(null);
    const app = await buildApp({ preferencesStore: store });
    const res = await app.inject({
      method: "PUT",
      url: "/api/preferences",
      payload: { workingHoursStart: "08:00", bufferMinutes: 30 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { workingHoursStart: string; bufferMinutes: number };
    expect(body.workingHoursStart).toBe("08:00");
    expect(body.bufferMinutes).toBe(30);
    // Untouched fields keep their defaults
    expect((body as import("@calendar-planner/shared").Preferences).workingHoursEnd).toBe("19:00");
    await app.close();
  });

  it("returns 400 when end <= start", async () => {
    const store = makeFakeStore(null);
    const app = await buildApp({ preferencesStore: store });
    const res = await app.inject({
      method: "PUT",
      url: "/api/preferences",
      payload: { workingHoursStart: "18:00", workingHoursEnd: "09:00" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 400 for malformed time string", async () => {
    const store = makeFakeStore(null);
    const app = await buildApp({ preferencesStore: store });
    const res = await app.inject({
      method: "PUT",
      url: "/api/preferences",
      payload: { workingHoursStart: "9am" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
