import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventsPopover, type EventItem } from "./EventsPopover.js";

const sample: EventItem[] = [
  { id: "1", summary: "Standup", start: "2026-07-08T09:00:00Z", end: "2026-07-08T09:15:00Z", allDay: false, type: "meeting" },
  { id: "2", summary: "Coffee chat", start: "2026-07-08T10:00:00Z", end: "2026-07-08T10:30:00Z", allDay: false, type: "personal" },
];

describe("EventsPopover", () => {
  it("renders the dialog with the time window and event titles", () => {
    render(
      <EventsPopover
        windowStart="2026-07-08T09:00:00Z"
        windowEnd="2026-07-08T10:00:00Z"
        events={sample}
        loading={false}
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Standup")).toBeInTheDocument();
    expect(within(dialog).getByText("Coffee chat")).toBeInTheDocument();
  });

  it("shows a loading state", () => {
    render(
      <EventsPopover
        windowStart="2026-07-08T09:00:00Z"
        windowEnd="2026-07-08T10:00:00Z"
        events={[]}
        loading
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId("events-loading")).toBeInTheDocument();
  });

  it("shows an empty state when no events are found", () => {
    render(
      <EventsPopover
        windowStart="2026-07-08T09:00:00Z"
        windowEnd="2026-07-08T10:00:00Z"
        events={[]}
        loading={false}
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId("events-empty")).toBeInTheDocument();
  });

  it("shows an error message when error is provided", () => {
    render(
      <EventsPopover
        windowStart="2026-07-08T09:00:00Z"
        windowEnd="2026-07-08T10:00:00Z"
        events={[]}
        loading={false}
        error="Не удалось получить события"
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId("events-error")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <EventsPopover
        windowStart="2026-07-08T09:00:00Z"
        windowEnd="2026-07-08T10:00:00Z"
        events={sample}
        loading={false}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole("button", { name: /закрыть/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <EventsPopover
        windowStart="2026-07-08T09:00:00Z"
        windowEnd="2026-07-08T10:00:00Z"
        events={sample}
        loading={false}
        onClose={onClose}
      />,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onEdit and onDelete when action buttons are clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <EventsPopover
        windowStart="2026-07-08T09:00:00Z"
        windowEnd="2026-07-08T10:00:00Z"
        events={sample}
        loading={false}
        onClose={() => {}}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    const editButtons = screen.getAllByTestId("edit-event-button");
    const deleteButtons = screen.getAllByTestId("delete-event-button");
    expect(editButtons).toHaveLength(2);
    expect(deleteButtons).toHaveLength(2);

    await user.click(editButtons[0]!);
    expect(onEdit).toHaveBeenCalledWith(sample[0]);

    await user.click(deleteButtons[1]!);
    expect(onDelete).toHaveBeenCalledWith(sample[1]);
  });
});
