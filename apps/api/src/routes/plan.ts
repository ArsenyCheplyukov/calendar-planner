import type { FastifyInstance } from "fastify";
import { parsePlan, type ParsePlanOptions } from "../infrastructure/gemini/parser.js";
import { suggestSlots, type CalendarClientFactory, type PlanParser } from "../services/suggest-slots.js";
import type { PreferencesStore } from "../infrastructure/preferences/store.js";
import { defaultPreferencesStore } from "../infrastructure/preferences/store.js";

export interface PlanRouteOptions {
  geminiApiKey?: string;
  parsePlanFn?: PlanParser;
  calendarClientFactory?: CalendarClientFactory;
  getAccessToken?: () => Promise<string | null>;
  preferencesStore?: PreferencesStore;
}

export async function planRoute(
  app: FastifyInstance,
  opts: PlanRouteOptions,
): Promise<void> {
  const parse = opts.parsePlanFn
    ? opts.parsePlanFn
    : (t: string) =>
        parsePlan(t, {
          apiKey: opts.geminiApiKey ?? process.env["GEMINI_API_KEY"] ?? "",
        });

  const getToken: () => Promise<string | null> =
    opts.getAccessToken ?? (() => Promise.resolve(null));

  app.post<{ Body: { text?: unknown; startDate?: string } }>("/api/plan", async (req, reply) => {
    const text = req.body?.text;
    if (typeof text !== "string" || text.trim().length === 0) {
      return reply.status(400).send({
        error: "bad_request",
        message: "`text` must be a non-empty string",
      });
    }

    try {
      const result = await suggestSlots(
        { text, startDate: req.body?.startDate },
        {
          parsePlan: parse,
          calendarClientFactory:
            opts.calendarClientFactory ??
            (() => {
              throw new Error("calendarClientFactory not provided");
            }),
          getAccessToken: getToken,
          preferencesStore: opts.preferencesStore ?? defaultPreferencesStore(),
        },
      );
      return { parsed: result.parsed, suggestions: result.suggestions };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return reply.status(502).send({ error: "upstream_error", message });
    }
  });
}

export type { CalendarClientFactory, PlanParser, ParsePlanOptions };
