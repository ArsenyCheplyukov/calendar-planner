import type { FastifyInstance } from "fastify";
import type { Preferences } from "@calendar-planner/shared";
import { DEFAULT_PREFERENCES } from "../domain/scorer.js";
import type { PreferencesStore } from "../infrastructure/preferences/store.js";

const TIME_RE = /^\d{2}:\d{2}$/;

function isValidTime(s: unknown): s is string {
  return typeof s === "string" && TIME_RE.test(s);
}

function validate(partial: Partial<Preferences>): string | null {
  if (partial.workingHoursStart !== undefined && !isValidTime(partial.workingHoursStart)) {
    return "workingHoursStart must be HH:MM";
  }
  if (partial.workingHoursEnd !== undefined && !isValidTime(partial.workingHoursEnd)) {
    return "workingHoursEnd must be HH:MM";
  }
  if (partial.bufferMinutes !== undefined && (typeof partial.bufferMinutes !== "number" || partial.bufferMinutes < 0)) {
    return "bufferMinutes must be a non-negative number";
  }
  for (const field of [
    "typeBiasFocus",
    "typeBiasMeeting",
    "typeBiasPersonal",
    "typeBiasErrand",
  ] as const) {
    const v = partial[field];
    if (v === undefined) continue;
    if (typeof v !== "string") return `${field} must be a string`;
    if (v !== "any" && !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(v)) {
      return `${field} must be "any" or HH:MM-HH:MM`;
    }
  }
  if (partial.blackouts !== undefined && !Array.isArray(partial.blackouts)) {
    return "blackouts must be an array";
  }

  // Cross-field: end > start
  const start = partial.workingHoursStart ?? DEFAULT_PREFERENCES.workingHoursStart;
  const end = partial.workingHoursEnd ?? DEFAULT_PREFERENCES.workingHoursEnd;
  if (start >= end) {
    return "workingHoursEnd must be after workingHoursStart";
  }
  return null;
}

export interface PreferencesRouteOptions {
  preferencesStore: PreferencesStore;
}

export async function preferencesRoute(
  app: FastifyInstance,
  opts: PreferencesRouteOptions,
): Promise<void> {
  app.get("/api/preferences", async () => {
    return opts.preferencesStore.getPreferences();
  });

  app.put<{ Body: Partial<Preferences> }>("/api/preferences", async (req, reply) => {
    const partial = req.body ?? {};
    const err = validate(partial);
    if (err) {
      return reply.status(400).send({ error: "bad_request", message: err });
    }
    const updated = await opts.preferencesStore.updatePreferences(partial);
    return updated;
  });
}
