import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import type { GoogleCalendarClient } from "../infrastructure/google/events.js";

function makeFakeEventsClient(id = "evt-test"): GoogleCalendarClient {
  return {
    events: {
      insert: vi.fn().mockResolvedValue({
        data: {
          id,
          summary: "Created",
          start: { dateTime: "2026-07-08T09:00:00Z" },
          end: { dateTime: "2026-07-08T10:00:00Z" },
        },
      }),
    },
  };
}

describe("POST /api/events", () => {
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

  it("creates an event and returns it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }),
          { status: 200 },
        ),
      ),
    );

    const fakeClient = makeFakeEventsClient("evt-123");
    const app = await buildApp({ eventsClientFactory: () => fakeClient });
    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        slot: { start: "2026-07-08T09:00:00Z", end: "2026-07-08T10:00:00Z" },
        parsedPlan: {
          title: "Подготовить презентацию",
          durationMinutes: 60,
          type: "focus",
          deadline: null,
          hint: null,
        },
        originalPlanText: "подготовить презентацию, 1 час",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { event: { id: string; summary?: string } };
    expect(body.event.id).toBe("evt-123");
    expect(body.event.summary).toBe("Created");
    await app.close();
  });

  it("uses the parsed plan title as the event summary and appends the marker to the description", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }),
          { status: 200 },
        ),
      ),
    );

    const insert = vi.fn().mockResolvedValue({
      data: { id: "evt", summary: "", start: {}, end: {} },
    });
    const app = await buildApp({
      eventsClientFactory: () => ({ events: { insert } }),
    });

    await app.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        slot: { start: "2026-07-08T09:00:00Z", end: "2026-07-08T10:00:00Z" },
        parsedPlan: {
          title: "Подготовить презентацию",
          durationMinutes: 60,
          type: "focus",
          deadline: null,
          hint: null,
        },
        originalPlanText: "подготовить презентацию, 1 час",
      },
    });

    const params = insert.mock.calls[0]![0];
    expect(params.requestBody.summary).toBe("Подготовить презентацию");
    expect(params.requestBody.description).toContain("подготовить презентацию, 1 час");
    expect(params.requestBody.description).toContain("Created via calendar-planner");
    await app.close();
  });

  it("creates an event from a manual title and description", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }),
          { status: 200 },
        ),
      ),
    );

    const insert = vi.fn().mockResolvedValue({
      data: { id: "evt-manual", summary: "", start: {}, end: {} },
    });
    const app = await buildApp({
      eventsClientFactory: () => ({ events: { insert } }),
    });

    await app.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        slot: { start: "2026-07-08T09:00:00Z", end: "2026-07-08T10:00:00Z" },
        title: "Ручное событие",
        description: "Описание от пользователя",
        location: "Офис",
      },
    });

    const params = insert.mock.calls[0]![0];
    expect(params.requestBody.summary).toBe("Ручное событие");
    expect(params.requestBody.description).toContain("Описание от пользователя");
    expect(params.requestBody.description).toContain("Created via calendar-planner");
    expect(params.requestBody.location).toBe("Офис");
    await app.close();
  });

  it("returns 400 when slot is missing start or end", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }),
          { status: 200 },
        ),
      ),
    );
    const app = await buildApp({ eventsClientFactory: makeFakeEventsClient });

    const resMissingStart = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        slot: { end: "2026-07-08T10:00:00Z" },
        parsedPlan: { title: "x", durationMinutes: 60, type: "focus" },
        originalPlanText: "x",
      },
    });
    expect(resMissingStart.statusCode).toBe(400);

    const resMissingEnd = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        slot: { start: "2026-07-08T09:00:00Z" },
        parsedPlan: { title: "x", durationMinutes: 60, type: "focus" },
        originalPlanText: "x",
      },
    });
    expect(resMissingEnd.statusCode).toBe(400);
    await app.close();
  });

  it("returns 502 when Google API call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }),
          { status: 200 },
        ),
      ),
    );
    const failingClient: GoogleCalendarClient = {
      events: {
        insert: vi.fn().mockRejectedValue(new Error("calendar down")),
      },
    };
    const app = await buildApp({ eventsClientFactory: () => failingClient });

    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        slot: { start: "2026-07-08T09:00:00Z", end: "2026-07-08T10:00:00Z" },
        parsedPlan: { title: "x", durationMinutes: 60, type: "focus" },
        originalPlanText: "x",
      },
    });
    expect(res.statusCode).toBe(502);
    await app.close();
  });
});
