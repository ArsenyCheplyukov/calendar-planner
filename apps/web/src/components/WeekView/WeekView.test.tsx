import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { WeekView, type WeekViewBusyMap, type WeekViewWeek } from "./WeekView.js";

describe("WeekView", () => {
  const sampleWeek: WeekViewWeek = {
    start: "2026-07-06T00:00:00.000Z",
    end: "2026-07-12T23:59:59.999Z",
  };

  it("renders a heading for the week with the month name and a range separator", () => {
    render(<WeekView week={sampleWeek} busy={{}} onPrev={() => {}} onNext={() => {}} onToday={() => {}} />);
    const heading = screen.getByRole("heading", { level: 2 });
    // Should mention the Russian month "июля" and contain a numeric range
    expect(heading.textContent).toMatch(/июля/);
    expect(heading.textContent).toMatch(/\d+\s*[–-]\s*\d+/);
  });

  it("renders 7 day columns with labels", () => {
    render(<WeekView week={sampleWeek} busy={{}} onPrev={() => {}} onNext={() => {}} onToday={() => {}} />);
    const grid = screen.getByTestId("week-grid");
    const dayColumns = within(grid).getAllByTestId("day-column");
    expect(dayColumns).toHaveLength(7);
  });

  it("calls onPrev / onNext / onToday when navigation buttons are clicked", () => {
    let prevCount = 0;
    let nextCount = 0;
    let todayCount = 0;

    render(
      <WeekView
        week={sampleWeek}
        busy={{}}
        onPrev={() => prevCount++}
        onNext={() => nextCount++}
        onToday={() => todayCount++}
      />,
    );

    screen.getByRole("button", { name: /предыдущая/i }).click();
    screen.getByRole("button", { name: /следующая/i }).click();
    screen.getByRole("button", { name: /сегодня/i }).click();

    expect(prevCount).toBe(1);
    expect(nextCount).toBe(1);
    expect(todayCount).toBe(1);
  });

  it("renders one busy block per interval in the busy map", () => {
    const busy: WeekViewBusyMap = {
      "2026-07-08": [
        { start: "2026-07-08T10:00:00Z", end: "2026-07-08T11:00:00Z" },
        { start: "2026-07-08T14:00:00Z", end: "2026-07-08T15:00:00Z" },
      ],
      "2026-07-10": [
        { start: "2026-07-10T09:00:00Z", end: "2026-07-10T10:00:00Z" },
      ],
    };
    render(<WeekView week={sampleWeek} busy={busy} onPrev={() => {}} onNext={() => {}} onToday={() => {}} />);

    const blocks = screen.getAllByTestId("busy-block");
    expect(blocks).toHaveLength(3);
  });

  it("marks past days with a data-past attribute", () => {
    // Pretend "today" is 2026-07-10
    render(
      <WeekView
        week={sampleWeek}
        busy={{}}
        onPrev={() => {}}
        onNext={() => {}}
        onToday={() => {}}
        today="2026-07-10"
      />,
    );
    const past = screen.getAllByTestId("day-column");
    // First 4 columns (Mon-Thu) are past, last 3 (Fri-Sun) are not
    const pastCount = past.filter((c) => c.getAttribute("data-past") === "true").length;
    const futureCount = past.filter((c) => c.getAttribute("data-past") === "false").length;
    expect(pastCount).toBe(4);
    expect(futureCount).toBe(3);
  });
});
