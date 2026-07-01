import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

describe("auth plugin", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("registers a tokenManager on the app instance", async () => {
    process.env["GOOGLE_REFRESH_TOKEN"] = "1//test";
    process.env["GOOGLE_CLIENT_ID"] = "cid";
    process.env["GOOGLE_CLIENT_SECRET"] = "csecret";

    const app = await buildApp();
    expect(app.tokenManager).toBeDefined();
    expect(typeof app.tokenManager.getAccessToken).toBe("function");
    await app.close();
  });

  describe("GET /api/health/auth", () => {
    it("returns 401 when GOOGLE_REFRESH_TOKEN is empty", async () => {
      delete process.env["GOOGLE_REFRESH_TOKEN"];
      process.env["GOOGLE_CLIENT_ID"] = "cid";
      process.env["GOOGLE_CLIENT_SECRET"] = "csecret";

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/health/auth" });

      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ error: expect.any(String) });
      await app.close();
    });

    it("returns 200 with { authenticated: true } when a valid refresh token is present", async () => {
      process.env["GOOGLE_REFRESH_TOKEN"] = "1//test";
      process.env["GOOGLE_CLIENT_ID"] = "cid";
      process.env["GOOGLE_CLIENT_SECRET"] = "csecret";

      // Stub the fetch used by TokenManager so the test never reaches Google.
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

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/health/auth" });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ authenticated: true });
      await app.close();
    });
  });
});
