import { describe, it, expect } from "vitest";
import { buildGoogleCalendarClient } from "./client.js";

describe("buildGoogleCalendarClient", () => {
  it("builds an authenticated Google Calendar client lazily", () => {
    const client = buildGoogleCalendarClient("ya29.test");
    expect(client.freebusy.query).toBeInstanceOf(Function);
    expect(client.events.insert).toBeInstanceOf(Function);
    expect(client.events.list).toBeInstanceOf(Function);
    expect(client.calendarList.list).toBeInstanceOf(Function);
  });
});
