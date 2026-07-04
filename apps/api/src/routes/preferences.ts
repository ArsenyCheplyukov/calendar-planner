import type { FastifyInstance } from "fastify";
import type { Preferences } from "@calendar-planner/shared";
import { DEFAULT_PREFERENCES } from "@calendar-planner/shared";
import type { PreferencesStore } from "../infrastructure/preferences/store.js";
import { sendRouteError, internalError } from "./error-mapper.js";

const TIME_RE = /^\d{2}:\d{2}$/;

function isValidTime(s: unknown): s is string {
  return typeof s === "string" && TIME_RE.test(s);
}

function isValidTimeZone(s: unknown): boolean {
  if (typeof s !== "string" || s.length === 0) return false;
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const zones = (Intl as any).supportedValuesOf("timeZone") as string[];
      return zones.includes(s);
    }
  } catch {
    // fall through to runtime check
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: s });
    return true;
  } catch {
    return false;
  }
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
  if (partial.timeZone !== undefined && !isValidTimeZone(partial.timeZone)) {
    return "timeZone must be a valid IANA time zone";
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
  app.get("/api/preferences", async (_req, reply) => {
    try {
      return await opts.preferencesStore.getPreferences();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return sendRouteError(internalError(message), reply);
    }
  });

  app.put<{ Body: Partial<Preferences> }>("/api/preferences", async (req, reply) => {
    const partial = req.body ?? {};
    const err = validate(partial);
    if (err) {
      return reply.status(400).send({ error: "bad_request", message: err });
    }
    try {
      const updated = await opts.preferencesStore.updatePreferences(partial);
      return updated;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return sendRouteError(internalError(message), reply);
    }
  });
}
