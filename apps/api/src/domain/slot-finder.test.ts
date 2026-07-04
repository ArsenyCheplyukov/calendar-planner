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

describe("findSlots — event buffers", () => {
  it("reserves a buffer before the event", () => {
    const busy: BusyMap = {
      "2026-07-06": [
        { start: "2026-07-06T08:30:00.000Z", end: "2026-07-06T09:00:00.000Z" },
      ],
    };
    // Without a before-buffer the slot could start at 09:00. With 30min before-buffer
    // the blocked span starts at 08:30 and collides with the busy block, so the
    // first viable event start is 09:30 (buffer 09:00–09:30 touches the busy end).
    const slots = findSlots(busy, WINDOW, 60, 0, new Date(2026, 6, 6), "UTC", [], 30, 0);
    const mondaySlot = slots.find((s) => s.start.startsWith("2026-07-06"));
    expect(mondaySlot).toBeDefined();
    expect(mondaySlot!.start).toBe("2026-07-06T09:30:00.000Z");
    expect(mondaySlot!.end).toBe("2026-07-06T10:30:00.000Z");
  });

  it("reserves a buffer after the event", () => {
    const busy: BusyMap = {
      "2026-07-06": [
        { start: "2026-07-06T10:00:00.000Z", end: "2026-07-06T10:30:00.000Z" },
      ],
    };
    // A 60-min event needs 30 free minutes after it. The only place that fits
    // inside the working window is after the busy block ends, so the first viable
    // event start is 10:30.
    const slots = findSlots(busy, WINDOW, 60, 0, new Date(2026, 6, 6), "UTC", [], 0, 30);
    const mondaySlot = slots.find((s) => s.start.startsWith("2026-07-06"));
    expect(mondaySlot).toBeDefined();
    expect(mondaySlot!.start).toBe("2026-07-06T10:30:00.000Z");
    expect(mondaySlot!.end).toBe("2026-07-06T11:30:00.000Z");
  });

  it("reserves buffers before and after the event", () => {
    const busy: BusyMap = {
      "2026-07-06": [
        { start: "2026-07-06T08:30:00.000Z", end: "2026-07-06T09:00:00.000Z" },
        { start: "2026-07-06T10:30:00.000Z", end: "2026-07-06T11:00:00.000Z" },
      ],
    };
    // Event 11:30–12:30 gives before-buffer 11:00–11:30 (touches first busy end)
    // and after-buffer 12:30–13:00 (free), so it is the earliest viable slot.
    const slots = findSlots(busy, WINDOW, 60, 0, new Date(2026, 6, 6), "UTC", [], 30, 30);
    const mondaySlot = slots.find((s) => s.start.startsWith("2026-07-06"));
    expect(mondaySlot).toBeDefined();
    expect(mondaySlot!.start).toBe("2026-07-06T11:30:00.000Z");
    expect(mondaySlot!.end).toBe("2026-07-06T12:30:00.000Z");
  });

  it("returns no slot when the buffered span does not fit", () => {
    const busy: BusyMap = {
      "2026-07-06": [
        { start: "2026-07-06T09:00:00.000Z", end: "2026-07-06T18:00:00.000Z" },
      ],
    };
    const slots = findSlots(busy, WINDOW, 60, 0, new Date(2026, 6, 6), "UTC", [], 30, 30);
    expect(slots.find((s) => s.start.startsWith("2026-07-06"))).toBeUndefined();
  });

  it("combines event buffers with the preference buffer around busy blocks", () => {
    const busy: BusyMap = {
      "2026-07-06": [
        { start: "2026-07-06T09:00:00.000Z", end: "2026-07-06T09:30:00.000Z" },
      ],
    };
    // 15-min preference buffer expands the busy block to 08:45–09:45.
    // A 15-min event before-buffer means the blocked span starts at candidateStart - 15.
    // Candidate 10:00 => blocked span 09:45–10:45, which no longer overlaps the
    // expanded busy block, so it is the first viable event start.
    const slots = findSlots(busy, WINDOW, 60, 15, new Date(2026, 6, 6), "UTC", [], 15, 0);
    const mondaySlot = slots.find((s) => s.start.startsWith("2026-07-06"));
    expect(mondaySlot).toBeDefined();
    expect(mondaySlot!.start).toBe("2026-07-06T10:00:00.000Z");
  });
});
