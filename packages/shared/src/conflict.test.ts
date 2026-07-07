import { describe, it, expect } from "vitest";
import { hasConflict, hasConflictInBusyMap } from "./conflict.js";
import type { BusyInterval, BusyMap } from "./index.js";

const SLOT = {
  start: "2026-07-06T10:00:00.000Z",
  end: "2026-07-06T11:00:00.000Z",
};

const BUSY: BusyInterval = {
  start: "2026-07-06T12:00:00.000Z",
  end: "2026-07-06T13:00:00.000Z",
};

describe("hasConflict", () => {
  it("returns false when the slot is completely before the busy interval", () => {
    const slot = { start: "2026-07-06T08:00:00.000Z", end: "2026-07-06T09:00:00.000Z" };
    expect(hasConflict(slot, [BUSY])).toBe(false);
  });

  it("returns false when the slot is completely after the busy interval", () => {
    const slot = { start: "2026-07-06T14:00:00.000Z", end: "2026-07-06T15:00:00.000Z" };
    expect(hasConflict(slot, [BUSY])).toBe(false);
  });

  it("returns true when the slot fully overlaps the busy interval", () => {
    const slot = { start: "2026-07-06T11:00:00.000Z", end: "2026-07-06T14:00:00.000Z" };
    expect(hasConflict(slot, [BUSY])).toBe(true);
  });

  it("returns true when the busy interval fully overlaps the slot", () => {
    const slot = { start: "2026-07-06T12:15:00.000Z", end: "2026-07-06T12:45:00.000Z" };
    expect(hasConflict(slot, [BUSY])).toBe(true);
  });

  it("returns true for a partial overlap at the start of the busy interval", () => {
    const slot = { start: "2026-07-06T11:30:00.000Z", end: "2026-07-06T12:30:00.000Z" };
    expect(hasConflict(slot, [BUSY])).toBe(true);
  });

  it("returns true for a partial overlap at the end of the busy interval", () => {
    const slot = { start: "2026-07-06T12:30:00.000Z", end: "2026-07-06T13:30:00.000Z" };
    expect(hasConflict(slot, [BUSY])).toBe(true);
  });

  it("treats an exact end-to-start boundary as non-conflicting", () => {
    const slot = { start: "2026-07-06T11:00:00.000Z", end: "2026-07-06T12:00:00.000Z" };
    expect(hasConflict(slot, [BUSY])).toBe(false);
  });

  it("treats an exact start-to-end boundary as non-conflicting", () => {
    const slot = { start: "2026-07-06T13:00:00.000Z", end: "2026-07-06T14:00:00.000Z" };
    expect(hasConflict(slot, [BUSY])).toBe(false);
  });

  it("returns false for an empty list of busy intervals", () => {
    expect(hasConflict(SLOT, [])).toBe(false);
  });

  it("detects a conflict introduced by the configured buffer", () => {
    // Slot ends 15 minutes before busy starts; with a 30-minute buffer it conflicts.
    const slot = { start: "2026-07-06T10:45:00.000Z", end: "2026-07-06T11:45:00.000Z" };
    expect(hasConflict(slot, [BUSY], 30)).toBe(true);
  });

  it("does not detect a conflict when the slot is outside the buffered busy interval", () => {
    const slot = { start: "2026-07-06T10:00:00.000Z", end: "2026-07-06T10:45:00.000Z" };
    expect(hasConflict(slot, [BUSY], 15)).toBe(false);
  });

  it("checks every interval in the list", () => {
    const slot = { start: "2026-07-06T14:30:00.000Z", end: "2026-07-06T15:30:00.000Z" };
    const busy: BusyInterval[] = [
      { start: "2026-07-06T08:00:00.000Z", end: "2026-07-06T09:00:00.000Z" },
      { start: "2026-07-06T14:00:00.000Z", end: "2026-07-06T15:00:00.000Z" },
    ];
    expect(hasConflict(slot, busy)).toBe(true);
  });

  it("accepts Date objects as well as ISO strings", () => {
    const slot = {
      start: new Date("2026-07-06T12:15:00.000Z"),
      end: new Date("2026-07-06T12:45:00.000Z"),
    };
    expect(hasConflict(slot, [BUSY])).toBe(true);
  });
});

describe("hasConflictInBusyMap", () => {
  it("returns false for an empty busy map", () => {
    const busy: BusyMap = {};
    expect(hasConflictInBusyMap(SLOT, busy)).toBe(false);
  });

  it("returns false when no day contains a conflicting interval", () => {
    const busy: BusyMap = {
      "2026-07-05": [{ start: "2026-07-05T12:00:00.000Z", end: "2026-07-05T13:00:00.000Z" }],
    };
    expect(hasConflictInBusyMap(SLOT, busy)).toBe(false);
  });

  it("returns true when any day contains a conflicting interval", () => {
    const slot = { start: "2026-07-06T11:00:00.000Z", end: "2026-07-06T12:30:00.000Z" };
    const busy: BusyMap = {
      "2026-07-05": [{ start: "2026-07-05T12:00:00.000Z", end: "2026-07-05T13:00:00.000Z" }],
      "2026-07-06": [{ start: "2026-07-06T12:00:00.000Z", end: "2026-07-06T13:00:00.000Z" }],
    };
    expect(hasConflictInBusyMap(slot, busy)).toBe(true);
  });

  it("applies the buffer to intervals across all days", () => {
    const busy: BusyMap = {
      "2026-07-06": [{ start: "2026-07-06T12:00:00.000Z", end: "2026-07-06T13:00:00.000Z" }],
    };
    const slot = { start: "2026-07-06T11:35:00.000Z", end: "2026-07-06T12:05:00.000Z" };
    expect(hasConflictInBusyMap(slot, busy, 30)).toBe(true);
  });
});
