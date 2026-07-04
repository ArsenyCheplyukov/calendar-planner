import type { FastifyInstance, FastifyRequest } from "fastify";
import { currentWeek, parseWeekStart, weekOf } from "../domain/week.js";
import { getLocalTimeZone } from "@calendar-planner/shared";
import {
  getFreeBusy,
  type GoogleCalendarClient,
} from "../infrastructure/google/freebusy.js";
import { sendRouteError, upstreamError } from "./error-mapper.js";

export type CalendarClientFactory = (accessToken: string) => GoogleCalendarClient;

export interface WeekRouteOptions {
  calendarClientFactory: CalendarClientFactory;
}

function pickTimeZone(req: FastifyRequest): string {
  const fromQuery = (req.query as Record<string, unknown>)["timeZone"];
  if (typeof fromQuery === "string" && fromQuery.length > 0) {
    return fromQuery;
  }
  const fromHeader = req.headers["x-device-timezone"];
  if (typeof fromHeader === "string" && fromHeader.length > 0) {
    return fromHeader;
  }
  return getLocalTimeZone();
}

export async function weekRoute(
  app: FastifyInstance,
  opts: WeekRouteOptions,
): Promise<void> {
  app.get<{ Querystring: { start?: string; timeZone?: string } }>("/api/week", async (req, reply) => {
    if (!req.accessToken) {
      return reply.status(401).send({
        error: "unauthenticated",
        message: "Run `pnpm auth` to bootstrap credentials.",
      });
    }

    const timeZone = pickTimeZone(req);

    const startParam = req.query.start;
    let week;
    if (startParam) {
      const parsed = parseWeekStart(startParam, timeZone);
      if (!parsed) {
        return reply.status(400).send({
          error: "bad_request",
          message: "`start` must be YYYY-MM-DD",
        });
      }
      week = weekOf(parsed, timeZone);
    } else {
      week = currentWeek(new Date(), timeZone);
    }

    const client = opts.calendarClientFactory(req.accessToken);

    try {
      const busy = await getFreeBusy(week, req.accessToken, client, timeZone);

      return {
        week: {
          start: week.start.toISOString(),
          end: week.end.toISOString(),
        },
        busy,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return sendRouteError(upstreamError(message), reply);
    }
  });
}
