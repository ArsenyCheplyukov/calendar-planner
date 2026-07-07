import type { BusyInterval, BusyMap } from "./index.js";

export interface TimeRange {
  start: string | Date;
  end: string | Date;
}

function toTimestamp(value: string | Date): number {
  return typeof value === "string" ? new Date(value).getTime() : value.getTime();
}

/**
 * Determines whether `slot` overlaps any of the supplied busy intervals,
 * expanding each busy interval by `bufferMinutes` on both sides.
 *
 * Touching boundaries (slot ends exactly when busy starts, or vice versa)
 * are treated as non-conflicting.
 */
export function hasConflict(
  slot: TimeRange,
  busyIntervals: BusyInterval[],
  bufferMinutes: number = 0,
): boolean {
  const start = toTimestamp(slot.start);
  const end = toTimestamp(slot.end);
  const bufferMs = bufferMinutes * 60 * 1000;

  for (const interval of busyIntervals) {
    const bStart = toTimestamp(interval.start) - bufferMs;
    const bEnd = toTimestamp(interval.end) + bufferMs;
    if (start < bEnd && end > bStart) {
      return true;
    }
  }
  return false;
}

/**
 * Convenience overload that accepts a day-keyed busy map.
 */
export function hasConflictInBusyMap(
  slot: TimeRange,
  busyMap: BusyMap,
  bufferMinutes: number = 0,
): boolean {
  for (const intervals of Object.values(busyMap)) {
    if (hasConflict(slot, intervals, bufferMinutes)) {
      return true;
    }
  }
  return false;
}
