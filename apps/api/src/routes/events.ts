import type { FastifyInstance } from "fastify";
import type { ParsedPlan, Slot } from "@calendar-planner/shared";
import {
  createEvent,
  type GoogleCalendarClient,
} from "../infrastructure/google/events.js";
import {
  buildEventsListClient,
  getEvents,
  type GoogleEventsClient,
  type ListedEvent,
} from "../infrastructure/google/getEvents.js";

export type EventsClientFactory = (accessToken: string) => GoogleCalendarClient;
export type EventsListClientFactory = (accessToken: string) => GoogleEventsClient;

export interface EventsRouteOptions {
  eventsClientFactory: EventsClientFactory;
  eventsListClientFactory?: EventsListClientFactory;
}

interface CreateEventBody {
  slot?: Partial<Slot>;
  parsedPlan?: ParsedPlan;
  originalPlanText?: string;
}

export async function eventsRoute(
  app: FastifyInstance,
  opts: EventsRouteOptions,
): Promise<void> {
  app.post<{ Body: CreateEventBody }>("/api/events", async (req, reply) => {
    const { slot, parsedPlan, originalPlanText } = req.body ?? {};

    if (!slot?.start || !slot?.end) {
      return reply.status(400).send({
        error: "bad_request",
        message: "`slot` must include start and end",
      });
    }
    if (!parsedPlan?.title) {
      return reply.status(400).send({
        error: "bad_request",
        message: "`parsedPlan.title` is required",
      });
    }
    if (typeof originalPlanText !== "string") {
      return reply.status(400).send({
        error: "bad_request",
        message: "`originalPlanText` is required",
      });
    }

    if (!req.accessToken) {
      return reply.status(401).send({
        error: "unauthenticated",
        message: "Run `pnpm auth` to bootstrap credentials.",
      });
    }

    const description = `${originalPlanText}\n\n---\nCreated via calendar-planner`;

    try {
      const client = opts.eventsClientFactory(req.accessToken);
      const event = await createEvent(
        {
          summary: parsedPlan.title,
          description,
          start: slot.start,
          end: slot.end,
        },
        req.accessToken,
        client,
      );
      return { event };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return reply.status(502).send({ error: "upstream_error", message });
    }
  });

  // GET /api/events?from=ISO&to=ISO — privacy-first on-demand event titles
  app.get<{ Querystring: { from?: string; to?: string } }>(
    "/api/events",
    async (req, reply) => {
      const { from, to } = req.query;
      if (!from || !to) {
        return reply.status(400).send({
          error: "bad_request",
          message: "`from` and `to` (ISO datetime) are required",
        });
      }
      if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
        return reply.status(400).send({
          error: "bad_request",
          message: "`from` and `to` must be valid ISO datetimes",
        });
      }
      if (!req.accessToken) {
        return reply.status(401).send({
          error: "unauthenticated",
          message: "Run `pnpm auth` to bootstrap credentials.",
        });
      }

      const listFactory = opts.eventsListClientFactory ?? buildEventsListClient;

      try {
        const client = listFactory(req.accessToken) as GoogleEventsClient;
        const events: ListedEvent[] = await getEvents(from, to, req.accessToken, client);
        return { events };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return reply.status(502).send({ error: "upstream_error", message });
    }
    },
  );
}
