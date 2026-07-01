import { describe, it, expect, vi } from "vitest";
import { createEvent, type GoogleCalendarClient } from "./events.js";

function makeClient(insertMock = vi.fn()): GoogleCalendarClient {
  return { events: { insert: insertMock } };
}

describe("createEvent", () => {
  it("calls events.insert with calendarId=primary and the right request body", async () => {
    const insert = vi.fn().mockResolvedValue({
      data: {
        id: "evt-1",
        summary: "Подготовить презентацию",
        start: { dateTime: "2026-07-08T09:00:00Z" },
        end: { dateTime: "2026-07-08T10:00:00Z" },
      },
    });
    const client = makeClient(insert);

    const result = await createEvent(
      {
        summary: "Подготовить презентацию",
        description: "prepare slides\n\n---\nCreated via calendar-planner",
        start: "2026-07-08T09:00:00Z",
        end: "2026-07-08T10:00:00Z",
      },
      "ya29.test",
      client,
    );

    expect(insert).toHaveBeenCalledTimes(1);
    const [params] = insert.mock.calls[0]!;
    expect(params.calendarId).toBe("primary");
    expect(params.sendUpdates).toBe("none");
    expect(params.requestBody).toEqual({
      summary: "Подготовить презентацию",
      description: "prepare slides\n\n---\nCreated via calendar-planner",
      start: { dateTime: "2026-07-08T09:00:00Z" },
      end: { dateTime: "2026-07-08T10:00:00Z" },
      transparency: "opaque",
    });
    expect(result.id).toBe("evt-1");
  });

  it("does not pass reminders (so Google defaults apply)", async () => {
    const insert = vi.fn().mockResolvedValue({ data: { id: "evt-1" } });
    await createEvent(
      {
        summary: "x",
        description: "y",
        start: "2026-07-08T09:00:00Z",
        end: "2026-07-08T10:00:00Z",
      },
      "ya29.test",
      makeClient(insert),
    );
    const [params] = insert.mock.calls[0]!;
    expect(params.requestBody.reminders).toBeUndefined();
  });

  it("throws a clear error when the Google API call fails", async () => {
    const insert = vi.fn().mockResolvedValue({ data: { id: "evt-1" } });
    insert.mockRejectedValue(new Error("403 forbidden"));
    await expect(
      createEvent(
        { summary: "x", description: "y", start: "a", end: "b" },
        "ya29.test",
        makeClient(insert),
      ),
    ).rejects.toThrow(/403/);
  });
});
