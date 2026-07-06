import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventForm } from "./EventForm.js";

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
});
