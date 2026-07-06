import { describe, it, expect } from "vitest";
import { mapGoogleEventType } from "./event-type.js";

describe("mapGoogleEventType", () => {
  it("maps focusTime to focus", () => {
    expect(mapGoogleEventType("focusTime")).toBe("focus");
  });

  it("maps outOfOffice to personal", () => {
    expect(mapGoogleEventType("outOfOffice")).toBe("personal");
  });

  it("maps workingLocation to meeting", () => {
    expect(mapGoogleEventType("workingLocation")).toBe("meeting");
  });

  it("falls back to meeting for default or unknown types", () => {
    expect(mapGoogleEventType("default")).toBe("meeting");
    expect(mapGoogleEventType("unknown")).toBe("meeting");
    expect(mapGoogleEventType()).toBe("meeting");
  });

  it("prefers a valid privately stored domain type over Google eventType", () => {
    expect(mapGoogleEventType("default", "errand")).toBe("errand");
    expect(mapGoogleEventType("focusTime", "personal")).toBe("personal");
  });

  it("ignores an invalid privately stored type", () => {
    expect(mapGoogleEventType("focusTime", "invalid")).toBe("focus");
  });
});
