import type { FastifyInstance } from "fastify";
import { parsePlanCandidates, type ParsePlanOptions } from "../infrastructure/gemini/parser.js";
import {
  suggestSlotCandidates,
  type CalendarClientFactory,
  type PlanCandidatesParser,
} from "../services/suggest-slots.js";
import type { PreferencesStore } from "../infrastructure/preferences/store.js";
import { defaultPreferencesStore } from "../infrastructure/preferences/store.js";
import { sendRouteError, upstreamError } from "./error-mapper.js";

export interface PlanRouteOptions {
  geminiApiKey?: string;
  parsePlanCandidatesFn?: PlanCandidatesParser;
  calendarClientFactory?: CalendarClientFactory;
  getAccessToken?: () => Promise<string | null>;
  preferencesStore?: PreferencesStore;
}

export async function planRoute(
  app: FastifyInstance,
  opts: PlanRouteOptions,
): Promise<void> {
  const parseCandidates: PlanCandidatesParser = opts.parsePlanCandidatesFn
    ? opts.parsePlanCandidatesFn
    : (t: string, tz: string) =>
        parsePlanCandidates(t, {
          apiKey: opts.geminiApiKey ?? process.env["GEMINI_API_KEY"] ?? "",
          timeZone: tz,
        });

  app.post<{ Body: { text?: unknown; startDate?: string; timeZone?: string } }>("/api/plan", async (req, reply) => {
    const text = req.body?.text;
    if (typeof text !== "string" || text.trim().length === 0) {
      return reply.status(400).send({
        error: "bad_request",
        message: "`text` must be a non-empty string",
      });
    }

    try {
      const result = await suggestSlotCandidates(
        {
          text,
          startDate: req.body?.startDate,
          timeZone: req.body?.timeZone,
        },
        {
          parsePlanCandidates: parseCandidates,
          calendarClientFactory:
            opts.calendarClientFactory ??
            (() => {
              throw new Error("calendarClientFactory not provided");
            }),
          getAccessToken: opts.getAccessToken ?? (() => Promise.resolve(null)),
          preferencesStore: opts.preferencesStore ?? defaultPreferencesStore(),
        },
      );

      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return sendRouteError(upstreamError(message), reply);
    }
  });
}

export type { CalendarClientFactory, PlanCandidatesParser, ParsePlanOptions };
