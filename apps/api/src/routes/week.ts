import type { FastifyInstance } from "fastify";
import { currentWeek, parseWeekStart, weekOf } from "../domain/week.js";
import {
  getFreeBusy,
  type GoogleCalendarClient,
} from "../infrastructure/google/freebusy.js";

export type CalendarClientFactory = (accessToken: string) => GoogleCalendarClient;

export interface WeekRouteOptions {
  calendarClientFactory: CalendarClientFactory;
}

export async function weekRoute(
  app: FastifyInstance,
  opts: WeekRouteOptions,
): Promise<void> {
  app.get<{ Querystring: { start?: string } }>("/api/week", async (req, reply) => {
    if (!req.accessToken) {
      return reply.status(401).send({
        error: "unauthenticated",
        message: "Run `pnpm auth` to bootstrap credentials.",
      });
    }

    const startParam = req.query.start;
    let week;
    if (startParam) {
      const parsed = parseWeekStart(startParam);
      if (!parsed) {
        return reply.status(400).send({
          error: "bad_request",
          message: "`start` must be YYYY-MM-DD",
        });
      }
      week = weekOf(parsed);
    } else {
      week = currentWeek();
    }

    const client = opts.calendarClientFactory(req.accessToken);
    const busy = await getFreeBusy(week, req.accessToken, client);

    return {
      week: {
        start: week.start.toISOString(),
        end: week.end.toISOString(),
      },
      busy,
    };
  });
}
