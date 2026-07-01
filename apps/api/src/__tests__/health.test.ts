import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

describe("GET /api/health", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 200 with { status: 'ok' }", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
