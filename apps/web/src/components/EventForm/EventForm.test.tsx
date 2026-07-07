import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventForm } from "./EventForm.js";
import type { BusyMap } from "@calendar-planner/shared";

const defaultInitials = {
  initialTitle: "Test",
  initialStart: "2026-07-08T09:00:00.000Z",
  initialEnd: "2026-07-08T10:00:00.000Z",
  initialType: "meeting" as const,
};

describe("EventForm", () => {
  it("renders an event type selector", () => {
    render(
      <EventForm
        {...defaultInitials}
        submitLabel="Create"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
  });

  it("submits with the selected event type", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <EventForm
        {...defaultInitials}
        submitLabel="Create"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/type/i), "focus");
    await user.click(screen.getByRole("button", { name: /create/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0]![0] as { type: string };
    expect(submitted.type).toBe("focus");
  });

  it("renders a soft conflict warning when the slot overlaps a busy block", () => {
    const busy: BusyMap = {
      "2026-07-08": [{ start: "2026-07-08T08:00:00.000Z", end: "2026-07-08T10:30:00.000Z" }],
    };
    render(
      <EventForm
        {...defaultInitials}
        submitLabel="Create"
        busy={busy}
        bufferMinutes={15}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId("conflict-warning")).toHaveTextContent(/overlaps with a busy block/i);
  });

  it("does not render a conflict warning when the slot is clean", () => {
    const busy: BusyMap = {
      "2026-07-08": [{ start: "2026-07-08T11:00:00.000Z", end: "2026-07-08T12:00:00.000Z" }],
    };
    render(
      <EventForm
        {...defaultInitials}
        submitLabel="Create"
        busy={busy}
        bufferMinutes={15}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("conflict-warning")).not.toBeInTheDocument();
  });

  it("ignores the excluded interval when detecting conflicts", () => {
    const busy: BusyMap = {
      "2026-07-08": [{ start: "2026-07-08T09:00:00.000Z", end: "2026-07-08T10:00:00.000Z" }],
    };
    render(
      <EventForm
        {...defaultInitials}
        submitLabel="Create"
        busy={busy}
        bufferMinutes={0}
        excludeInterval={{ start: "2026-07-08T09:00:00.000Z", end: "2026-07-08T10:00:00.000Z" }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("conflict-warning")).not.toBeInTheDocument();
  });

  it("allows submission even when a conflict warning is shown", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const busy: BusyMap = {
      "2026-07-08": [{ start: "2026-07-08T08:00:00.000Z", end: "2026-07-08T10:30:00.000Z" }],
    };
    render(
      <EventForm
        {...defaultInitials}
        submitLabel="Create"
        busy={busy}
        bufferMinutes={0}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /create/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
