import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import authPlugin from "./plugins/authPlugin.js";
import { healthAuthRoute } from "./routes/healthAuth.js";
import { weekRoute, type CalendarClientFactory } from "./routes/week.js";
import { planRoute, type PlanParser } from "./routes/plan.js";
import { buildCalendarClient } from "./infrastructure/google/freebusy.js";

export interface BuildAppOptions {
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  calendarClientFactory?: CalendarClientFactory;
  geminiApiKey?: string;
  parsePlanFn?: PlanParser;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
    },
  });

  await app.register(cors, {
    origin: true,
  });

  const refreshToken =
    options.refreshToken ?? process.env["GOOGLE_REFRESH_TOKEN"] ?? "";
  const clientId = options.clientId ?? process.env["GOOGLE_CLIENT_ID"] ?? "";
  const clientSecret =
    options.clientSecret ?? process.env["GOOGLE_CLIENT_SECRET"] ?? "";

  await app.register(authPlugin, {
    refreshToken,
    clientId,
    clientSecret,
  });

  app.get("/api/health", async () => {
    return { status: "ok" };
  });

  await app.register(healthAuthRoute);

  await app.register(weekRoute, {
    calendarClientFactory: options.calendarClientFactory ?? buildCalendarClient,
  });

  await app.register(planRoute, {
    geminiApiKey: options.geminiApiKey,
    parsePlanFn: options.parsePlanFn,
    calendarClientFactory: options.calendarClientFactory,
  });

  return app;
}
