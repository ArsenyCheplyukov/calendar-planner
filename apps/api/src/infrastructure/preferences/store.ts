import { PrismaClient, type Preferences as PrismaPreferences } from "@prisma/client";
import type { Preferences } from "@calendar-planner/shared";
import { DEFAULT_PREFERENCES } from "../../domain/scorer.js";

/** Minimal Prisma surface the store depends on. Lets us mock in tests. */
export interface PreferencesPrismaLike {
  preferences: {
    findUnique: (args: { where: { id: number } }) => Promise<PrismaPreferences | null>;
    upsert: (args: {
      where: { id: number };
      create: PrismaPreferences;
      update: Partial<PrismaPreferences>;
    }) => Promise<PrismaPreferences>;
  };
}

function rowToPreferences(row: PrismaPreferences): Preferences {
  let blackouts: Preferences["blackouts"] = [];
  try {
    const parsed: unknown = JSON.parse(row.blackoutsJson);
    if (Array.isArray(parsed)) blackouts = parsed as Preferences["blackouts"];
  } catch {
    // ignore malformed JSON
  }
  return {
    workingHoursStart: row.workingHoursStart,
    workingHoursEnd: row.workingHoursEnd,
    bufferMinutes: row.bufferMinutes,
    typeBiasFocus: row.typeBiasFocus,
    typeBiasMeeting: row.typeBiasMeeting,
    typeBiasPersonal: row.typeBiasPersonal,
    typeBiasErrand: row.typeBiasErrand,
    blackouts,
  };
}

function defaultsToRow(): Omit<PrismaPreferences, "updatedAt"> {
  return {
    id: 1,
    workingHoursStart: DEFAULT_PREFERENCES.workingHoursStart,
    workingHoursEnd: DEFAULT_PREFERENCES.workingHoursEnd,
    bufferMinutes: DEFAULT_PREFERENCES.bufferMinutes,
    typeBiasFocus: DEFAULT_PREFERENCES.typeBiasFocus,
    typeBiasMeeting: DEFAULT_PREFERENCES.typeBiasMeeting,
    typeBiasPersonal: DEFAULT_PREFERENCES.typeBiasPersonal,
    typeBiasErrand: DEFAULT_PREFERENCES.typeBiasErrand,
    blackoutsJson: JSON.stringify(DEFAULT_PREFERENCES.blackouts),
  };
}

export class PreferencesStore {
  private readonly prisma: PreferencesPrismaLike;

  constructor(prisma: PreferencesPrismaLike) {
    this.prisma = prisma;
  }

  async getPreferences(): Promise<Preferences> {
    const row = await this.prisma.preferences.findUnique({ where: { id: 1 } });
    if (!row) return { ...DEFAULT_PREFERENCES };
    return rowToPreferences(row);
  }

  async updatePreferences(partial: Partial<Preferences>): Promise<Preferences> {
    const data: Partial<PrismaPreferences> = {};
    if (partial.workingHoursStart !== undefined) data.workingHoursStart = partial.workingHoursStart;
    if (partial.workingHoursEnd !== undefined) data.workingHoursEnd = partial.workingHoursEnd;
    if (partial.bufferMinutes !== undefined) data.bufferMinutes = partial.bufferMinutes;
    if (partial.typeBiasFocus !== undefined) data.typeBiasFocus = partial.typeBiasFocus;
    if (partial.typeBiasMeeting !== undefined) data.typeBiasMeeting = partial.typeBiasMeeting;
    if (partial.typeBiasPersonal !== undefined) data.typeBiasPersonal = partial.typeBiasPersonal;
    if (partial.typeBiasErrand !== undefined) data.typeBiasErrand = partial.typeBiasErrand;
    if (partial.blackouts !== undefined) data.blackoutsJson = JSON.stringify(partial.blackouts);

    const result = await this.prisma.preferences.upsert({
      where: { id: 1 },
      create: { ...defaultsToRow(), ...data, id: 1, updatedAt: new Date() } as PrismaPreferences,
      update: data,
    });
    return rowToPreferences(result);
  }
}

let _singleton: PreferencesStore | null = null;

export function defaultPreferencesStore(): PreferencesStore {
  if (_singleton) return _singleton;
  // Lazy Prisma construction: only when first called at runtime, not in tests.
  const prisma = new PrismaClient();
  _singleton = new PreferencesStore(prisma as unknown as PreferencesPrismaLike);
  return _singleton;
}
