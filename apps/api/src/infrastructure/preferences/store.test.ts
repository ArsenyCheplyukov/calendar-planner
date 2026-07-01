import { describe, it, expect, beforeEach } from "vitest";
import { PreferencesStore } from "./store.js";
import { DEFAULT_PREFERENCES } from "../../domain/scorer.js";
import type { Preferences } from "@calendar-planner/shared";

interface MockRow {
  id: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  bufferMinutes: number;
  typeBiasFocus: string;
  typeBiasMeeting: string;
  typeBiasPersonal: string;
  typeBiasErrand: string;
  blackoutsJson: string;
  updatedAt: Date;
}

function makeFakePrisma(initial: MockRow | null = null) {
  let row: MockRow | null = initial;
  return {
    preferences: {
      findUnique: async () => row,
      upsert: async (args: { where: { id: number }; create: MockRow; update: Partial<MockRow> }) => {
        if (!row) {
          row = { ...args.create, updatedAt: new Date() };
        } else {
          row = { ...row, ...args.update, updatedAt: new Date() };
        }
        return row;
      },
    },
  };
}

describe("PreferencesStore", () => {
  it("returns DEFAULT_PREFERENCES when no row exists", async () => {
    const fake = makeFakePrisma(null);
    const store = new PreferencesStore(fake as never);
    const result = await store.getPreferences();
    expect(result).toEqual(DEFAULT_PREFERENCES);
  });

  it("returns stored values when a row exists", async () => {
    const fake = makeFakePrisma({
      id: 1,
      workingHoursStart: "10:00",
      workingHoursEnd: "18:00",
      bufferMinutes: 30,
      typeBiasFocus: "08:00-11:00",
      typeBiasMeeting: "12:00-17:00",
      typeBiasPersonal: "any",
      typeBiasErrand: "17:00-19:00",
      blackoutsJson: "[]",
      updatedAt: new Date(),
    });
    const store = new PreferencesStore(fake as never);
    const result = await store.getPreferences();
    expect(result.workingHoursStart).toBe("10:00");
    expect(result.workingHoursEnd).toBe("18:00");
    expect(result.bufferMinutes).toBe(30);
    expect(result.blackouts).toEqual([]);
  });

  it("updatePreferences merges partial and persists", async () => {
    const fake = makeFakePrisma(null);
    const store = new PreferencesStore(fake as never);

    const updated: Preferences = await store.updatePreferences({
      workingHoursStart: "08:00",
      bufferMinutes: 30,
    });

    expect(updated.workingHoursStart).toBe("08:00");
    expect(updated.bufferMinutes).toBe(30);
    // Untouched fields keep defaults
    expect(updated.workingHoursEnd).toBe(DEFAULT_PREFERENCES.workingHoursEnd);
    expect(updated.typeBiasFocus).toBe(DEFAULT_PREFERENCES.typeBiasFocus);
  });
});
