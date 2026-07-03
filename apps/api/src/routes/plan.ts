import type { FastifyInstance } from "fastify";
import { parsePlanCandidates, type ParsePlanOptions } from "../infrastructure/gemini/parser.js";
import {
  buildSuggestSlotsContext,
  scorePlan,
  type CalendarClientFactory,
  type PlanParser,
} from "../services/suggest-slots.js";
import type { PlanCandidate, ParsedPlan } from "@calendar-planner/shared";
import type { PreferencesStore } from "../infrastructure/preferences/store.js";
import { defaultPreferencesStore } from "../infrastructure/preferences/store.js";

export type PlanCandidatesParser = (text: string, timeZone: string) => Promise<ParsedPlan[]>;

export interface PlanRouteOptions {
  geminiApiKey?: string;
  parsePlanFn?: PlanParser;
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

  const getToken: () => Promise<string | null> =
    opts.getAccessToken ?? (() => Promise.resolve(null));

  app.post<{ Body: { text?: unknown; startDate?: string; timeZone?: string } }>("/api/plan", async (req, reply) => {
    const text = req.body?.text;
    if (typeof text !== "string" || text.trim().length === 0) {
      return reply.status(400).send({
        error: "bad_request",
        message: "`text` must be a non-empty string",
      });
    }

    try {
      const input = {
        text,
        startDate: req.body?.startDate,
        timeZone: req.body?.timeZone,
      };
      const context = await buildSuggestSlotsContext(input, {
        calendarClientFactory:
          opts.calendarClientFactory ??
          (() => {
            throw new Error("calendarClientFactory not provided");
          }),
        getAccessToken: getToken,
        preferencesStore: opts.preferencesStore ?? defaultPreferencesStore(),
      });

      const parsedPlans = await parseCandidates(text, context.effectiveTimeZone);
      const candidates: PlanCandidate[] = parsedPlans.map((parsedPlan, index) => ({
        candidateId: `candidate-${index + 1}`,
        rank: index + 1,
        parsedPlan,
        suggestions: scorePlan(parsedPlan, context),
      }));

      const selectedCandidate = candidates[0];
      if (!selectedCandidate) {
        return reply.status(502).send({
          error: "upstream_error",
          message: "Plan parser returned no valid candidates",
        });
      }

      return {
        candidates,
        selectedCandidateId: selectedCandidate.candidateId,
        parsed: selectedCandidate.parsedPlan,
        suggestions: selectedCandidate.suggestions,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return reply.status(502).send({ error: "upstream_error", message });
    }
  });
}

export type { CalendarClientFactory, PlanParser, ParsePlanOptions };
