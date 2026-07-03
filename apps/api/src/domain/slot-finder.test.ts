import { describe, it, expect } from "vitest";
import { findSlots, type WorkingWindow } from "./slot-finder.js";
import type { BusyMap, Preferences } from "@calendar-planner/shared";

const NO_BLACKOUTS: Preferences["blackouts"] = [];

const WINDOW: WorkingWindow = { start: "09:00", end: "19:00" };

function emptyBusy(): BusyMap {
  return {};
}

describe("findSlots — basic", () => {
  it("returns an empty array for empty busy map and 0 minutes duration", () => {
    const slots = findSlots(emptyBusy(), WINDOW, 0, 0, new Date(2026, 6, 6));
    expect(slots).toEqual([]);
  });

  it("returns the earliest viable slot per day for a fully empty week", () => {
    const slots = findSlots(emptyBusy(), WINDOW, 60, 0, new Date(2026, 6, 6));
    expect(slots).toHaveLength(7);
    // First slot should be Mon 09:00–10:00
    expect(slots[0]?.start).toBe("2026-07-06T09:00:00.000Z");
    expect(slots[0]?.end).toBe("2026-07-06T10:00:00.000Z");
  });
});

describe("findSlots — busy overlap", () => {
  it("skips candidates that overlap a busy block", () => {
    const busy: BusyMap = {
      "2026-07-06": [
        { start: "2026-07-06T09:00:00.000Z", end: "2026-07-06T11:00:00.000Z" },
      ],
    };
    const slots = findSlots(busy, WINDOW, 60, 0, new Date(2026, 6, 6));
    // Mon's first viable slot should be 11:00 or later
    const first = slots[0]!;
    expect(new Date(first.start).getTime()).toBeGreaterThanOrEqual(
      new Date("2026-07-06T11:00:00.000Z").getTime(),
    );
  });
});

describe("findSlots — buffer", () => {
  it("respects a 15-minute buffer between busy and slot", () => {
    // Busy 09:00-10:00. With 15min buffer, the next slot can't start before 10:15
    const busy: BusyMap = {
      "2026-07-06": [
        { start: "2026-07-06T09:00:00.000Z", end: "2026-07-06T10:00:00.000Z" },
      ],
    };
    const slots = findSlots(busy, WINDOW, 30, 15, new Date(2026, 6, 6));
    // The earliest 30-min slot should start at 10:15 or later
    const first = slots[0]!;
    const start = new Date(first.start);
    expect(start.getUTCHours()).toBe(10);
    expect(start.getUTCMinutes()).toBeGreaterThanOrEqual(15);
  });
});

describe("findSlots — duration", () => {
  it("returns no slot when the duration does not fit in any free window", () => {
    // Busy covers the entire day
    const busy: BusyMap = {
      "2026-07-06": [
        { start: "2026-07-06T08:00:00.000Z", end: "2026-07-06T20:00:00.000Z" },
      ],
    };
    const slots = findSlots(busy, WINDOW, 60, 0, new Date(2026, 6, 6));
    expect(slots.find((s) => s.start.startsWith("2026-07-06"))).toBeUndefined();
  });
});

describe("findSlots — one slot per day", () => {
  it("returns exactly one slot per day even if multiple candidates are viable", () => {
    const slots = findSlots(emptyBusy(), WINDOW, 30, 0, new Date(2026, 6, 6));
    expect(slots).toHaveLength(7);
  });
});

describe("findSlots — week boundary", () => {
  it("only returns slots within the Mon–Sun week containing the given Monday", () => {
    const slots = findSlots(emptyBusy(), WINDOW, 30, 0, new Date(2026, 6, 6));
    for (const s of slots) {
      const day = Number(s.start.slice(8, 10));
      expect(day).toBeGreaterThanOrEqual(6);
      expect(day).toBeLessThanOrEqual(12);
    }
  });
});

describe("findSlots — blackouts", () => {
  it("skips slots that overlap a blackout window", () => {
    const blackouts: Preferences["blackouts"] = [
      { dayOfWeek: "mon", start: "09:00", end: "12:15" },
    ];
    const slots = findSlots(emptyBusy(), WINDOW, 60, 0, new Date(2026, 6, 6), "UTC", blackouts);
    const mondaySlot = slots.find((s) => s.start.startsWith("2026-07-06"));
    expect(mondaySlot).toBeDefined();
    expect(mondaySlot!.start).toBe("2026-07-06T12:15:00.000Z");
  });

  it("ignores blackouts on a different day of the week", () => {
    const blackouts: Preferences["blackouts"] = [
      { dayOfWeek: "tue", start: "09:00", end: "18:00" },
    ];
    const slots = findSlots(emptyBusy(), WINDOW, 60, 0, new Date(2026, 6, 6), "UTC", blackouts);
    const mondaySlot = slots.find((s) => s.start.startsWith("2026-07-06"));
    expect(mondaySlot).toBeDefined();
    expect(mondaySlot!.start).toBe("2026-07-06T09:00:00.000Z");
  });

  it("treats an empty blackout list as no blackouts", () => {
    const slots = findSlots(emptyBusy(), WINDOW, 60, 0, new Date(2026, 6, 6), "UTC", []);
    expect(slots[0]?.start).toBe("2026-07-06T09:00:00.000Z");
  });
});
