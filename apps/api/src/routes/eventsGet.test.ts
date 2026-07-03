import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import type { GoogleEventsClient } from "../infrastructure/google/getEvents.js";

type ListFactory = (token: string) => GoogleEventsClient;

function makeFakeListFactory(items: unknown[] = []): ListFactory {
  return (_token: string) => ({
    calendarList: {
      list: vi.fn().mockResolvedValue({ data: { items: [{ id: "primary" }] } }),
    },
    events: {
      list: vi.fn().mockResolvedValue({ data: { items } }),
    },
  });
}

function makeFailingListFactory(): ListFactory {
  return (_token: string) => ({
    calendarList: {
      list: vi.fn().mockRejectedValue(new Error("503 service unavailable")),
    },
    events: {
      list: vi.fn().mockRejectedValue(new Error("should not be called")),
    },
  });
}

describe("GET /api/events", () => {
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

  it("returns 400 when from is missing", async () => {
    const app = await buildApp({ eventsListClientFactory: makeFakeListFactory() });
    const res = await app.inject({ method: "GET", url: "/api/events?to=2026-07-12T23:59:59.999Z" });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 400 when to is missing", async () => {
    const app = await buildApp({ eventsListClientFactory: makeFakeListFactory() });
    const res = await app.inject({ method: "GET", url: "/api/events?from=2026-07-06T00:00:00.000Z" });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 400 when from is malformed", async () => {
    const app = await buildApp({ eventsListClientFactory: makeFakeListFactory() });
    const res = await app.inject({
      method: "GET",
      url: "/api/events?from=not-a-date&to=2026-07-12T23:59:59.999Z",
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 401 without an access token", async () => {
    delete process.env["GOOGLE_REFRESH_TOKEN"];
    const app = await buildApp({ eventsListClientFactory: makeFakeListFactory() });
    const res = await app.inject({
      method: "GET",
      url: "/api/events?from=2026-07-06T00:00:00.000Z&to=2026-07-12T23:59:59.999Z",
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("returns the events for the given window", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }),
          { status: 200 },
        ),
      ),
    );

    const fakeItems = [
      {
        id: "evt-1",
        calendarId: "primary",
        summary: "Standup",
        start: { dateTime: "2026-07-08T09:00:00Z" },
        end: { dateTime: "2026-07-08T09:15:00Z" },
      },
    ];
    const app = await buildApp({ eventsListClientFactory: makeFakeListFactory(fakeItems) });
    const res = await app.inject({
      method: "GET",
      url: "/api/events?from=2026-07-06T00:00:00.000Z&to=2026-07-12T23:59:59.999Z",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { events: Array<{ id: string; summary: string }> };
    expect(body.events).toHaveLength(1);
    expect(body.events[0]?.id).toBe("evt-1");
    expect(body.events[0]?.summary).toBe("Standup");
    await app.close();
  });

  it("returns 502 when Google API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }),
          { status: 200 },
        ),
      ),
    );
    const app = await buildApp({ eventsListClientFactory: makeFailingListFactory() });
    const res = await app.inject({
      method: "GET",
      url: "/api/events?from=2026-07-06T00:00:00.000Z&to=2026-07-12T23:59:59.999Z",
    });
    expect(res.statusCode).toBe(502);
    await app.close();
  });
});
