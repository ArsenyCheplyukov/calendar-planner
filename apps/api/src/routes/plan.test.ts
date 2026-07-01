import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

describe("POST /api/plan", () => {
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

  it("returns 400 when text is empty", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/plan",
      payload: { text: "" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "bad_request" });
    await app.close();
  });

  it("returns 400 when text is whitespace only", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/plan",
      payload: { text: "   \n\t  " },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns the parsed plan from Gemini", async () => {
    const validPlan = {
      title: "Подготовить презентацию",
      durationMinutes: 120,
      type: "focus",
      deadline: null,
      hint: null,
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("generativelanguage.googleapis.com")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                candidates: [
                  {
                    content: {
                      role: "model",
                      parts: [{ text: JSON.stringify(validPlan) }],
                    },
                  },
                ],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            ),
          );
        }
        // OAuth refresh for auth plugin
        return Promise.resolve(
          new Response(
            JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }),
            { status: 200 },
          ),
        );
      }),
    );

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/plan",
      payload: { text: "подготовить презентацию, 2 часа" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { parsed: typeof validPlan };
    expect(body.parsed).toEqual(validPlan);
    await app.close();
  });

  it("returns 502 when Gemini fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("generativelanguage.googleapis.com")) {
          return Promise.resolve(new Response("upstream broken", { status: 500 }));
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }),
            { status: 200 },
          ),
        );
      }),
    );

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/plan",
      payload: { text: "test" },
    });

    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: "upstream_error" });
    await app.close();
  });
});
