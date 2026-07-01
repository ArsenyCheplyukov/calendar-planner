import type { FastifyInstance } from "fastify";
import { parsePlan, type ParsePlanOptions } from "../infrastructure/gemini/parser.js";

export type PlanParser = (text: string) => ReturnType<typeof parsePlan>;

export interface PlanRouteOptions {
  geminiApiKey?: string;
  parsePlanFn?: PlanParser;
}

export async function planRoute(
  app: FastifyInstance,
  opts: PlanRouteOptions,
): Promise<void> {
  app.post<{ Body: { text?: unknown } }>("/api/plan", async (req, reply) => {
    const text = req.body?.text;
    if (typeof text !== "string" || text.trim().length === 0) {
      return reply.status(400).send({
        error: "bad_request",
        message: "`text` must be a non-empty string",
      });
    }

    const parse = opts.parsePlanFn
      ? opts.parsePlanFn
      : (t: string) =>
          parsePlan(t, {
            apiKey: opts.geminiApiKey ?? process.env["GEMINI_API_KEY"] ?? "",
          });

    try {
      const parsed = await parse(text);
      return { parsed };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return reply.status(502).send({
        error: "upstream_error",
        message,
      });
    }
  });
}

// Re-export the type to keep `parsePlan` discoverable
export type { ParsePlanOptions };
