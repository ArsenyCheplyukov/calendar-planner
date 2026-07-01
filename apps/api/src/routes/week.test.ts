import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import type { GoogleCalendarClient } from "../infrastructure/google/freebusy.js";

function makeFakeCalendarClient(busy: Record<string, Array<{ start: string; end: string }>> = {}): GoogleCalendarClient {
  return {
    freebusy: {
      query: vi.fn().mockResolvedValue({
        data: {
          calendars: Object.fromEntries(
            Object.entries(busy).map(([, slots]) => ["primary", { busy: slots }]),
          ),
        },
      }),
    },
  };
}

describe("GET /api/week", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env["GOOGLE_REFRESH_TOKEN"] = "1//test";
    process.env["GOOGLE_CLIENT_ID"] = "cid";
    process.env["GOOGLE_CLIENT_SECRET"] = "csecret";
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns 401 when no access token is available", async () => {
    // Force TokenManager to return null by not stubbing fetch
    delete process.env["GOOGLE_REFRESH_TOKEN"];

    const app = await buildApp({ calendarClientFactory: () => makeFakeCalendarClient() });
    const res = await app.inject({ method: "GET", url: "/api/week" });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "unauthenticated" });
    await app.close();
  });

  it("returns the current week with busy map when authenticated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "ya29.test",
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const fakeClient = makeFakeCalendarClient({
      "2026-07-08": [
        { start: "2026-07-08T10:00:00Z", end: "2026-07-08T11:00:00Z" },
      ],
    });
    const factory = vi.fn().mockReturnValue(fakeClient);

    const app = await buildApp({ calendarClientFactory: factory });
    const res = await app.inject({ method: "GET", url: "/api/week" });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { week: { start: string; end: string }; busy: Record<string, unknown[]> };
    expect(body.week.start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.week.end).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(factory).toHaveBeenCalledWith("ya29.test");
    expect(body.busy["2026-07-08"]).toHaveLength(1);
    await app.close();
  });

  it("accepts ?start=YYYY-MM-DD to fetch a specific week", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "ya29.test",
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const fakeClient = makeFakeCalendarClient();
    const factory = vi.fn().mockReturnValue(fakeClient);

    const app = await buildApp({ calendarClientFactory: factory });
    const res = await app.inject({
      method: "GET",
      url: "/api/week?start=2026-07-06",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { week: { start: string; end: string } };
    // 2026-07-06 is a Monday; week should be 2026-07-06 to 2026-07-12 in local time.
    // .toISOString() always returns UTC, so we parse back and check the local date.
    const startLocal = new Date(body.week.start);
    const endLocal = new Date(body.week.end);
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(ymd(startLocal)).toBe("2026-07-06");
    expect(ymd(endLocal)).toBe("2026-07-12");
    await app.close();
  });

  it("returns 400 for malformed ?start= parameter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "ya29.test",
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const app = await buildApp({ calendarClientFactory: () => makeFakeCalendarClient() });
    const res = await app.inject({
      method: "GET",
      url: "/api/week?start=not-a-date",
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
