import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import {
  sendRouteError,
  badRequest,
  unauthenticated,
  upstreamError,
  internalError,
  RouteError,
} from "./error-mapper.js";

describe("sendRouteError", () => {
  async function run(error: unknown): Promise<{ statusCode: number; body: unknown }> {
    const app = Fastify();
    app.get("/test", async (_req, reply) => {
      return sendRouteError(error, reply);
    });
    const res = await app.inject({ method: "GET", url: "/test" });
    const result = { statusCode: res.statusCode, body: res.json() };
    await app.close();
    return result;
  }

  it("returns 400 for bad_request", async () => {
    const res = await run(badRequest("invalid input"));
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "bad_request", message: "invalid input" });
  });

  it("returns 401 for unauthenticated", async () => {
    const res = await run(unauthenticated("log in"));
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "unauthenticated", message: "log in" });
  });

  it("returns 502 for upstream_error", async () => {
    const res = await run(upstreamError("calendar down"));
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: "upstream_error", message: "calendar down" });
  });

  it("returns 500 for internal_error", async () => {
    const res = await run(internalError("boom"));
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "internal_error", message: "boom" });
  });

  it("returns 500 internal_error for unknown errors", async () => {
    const res = await run(new Error("unexpected"));
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "internal_error", message: "unexpected" });
  });

  it("returns 500 internal_error for non-error values", async () => {
    const res = await run("string throw");
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "internal_error", message: "string throw" });
  });
});

describe("RouteError constructors", () => {
  it("produces RouteError instances", () => {
    expect(badRequest("x")).toBeInstanceOf(RouteError);
    expect(unauthenticated("x")).toBeInstanceOf(RouteError);
    expect(upstreamError("x")).toBeInstanceOf(RouteError);
    expect(internalError("x")).toBeInstanceOf(RouteError);
  });
});
