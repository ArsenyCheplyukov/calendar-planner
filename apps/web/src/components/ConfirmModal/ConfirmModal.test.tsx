import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmModal } from "./ConfirmModal.js";
import type { Suggestion, ParsedPlan } from "@calendar-planner/shared";

const suggestion: Suggestion = {
  start: "2026-07-08T09:00:00.000Z",
  end: "2026-07-08T10:00:00.000Z",
  score: 0.85,
  reason: "ср 09:00–10:00, 60 мин (фокус)",
};

const parsedPlan: ParsedPlan = {
  title: "Подготовить презентацию",
  durationMinutes: 60,
  type: "focus",
  deadline: null,
  hint: null,
};

const originalPlanText = "подготовить презентацию, 1 час";

describe("ConfirmModal", () => {
  it("renders the title, start/end times, and the original plan text", () => {
    render(
      <ConfirmModal
        suggestion={suggestion}
        parsedPlan={parsedPlan}
        originalPlanText={originalPlanText}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(parsedPlan.title)).toBeInTheDocument();
    expect(within(dialog).getByText(/09:00/)).toBeInTheDocument();
    expect(within(dialog).getByText(/10:00/)).toBeInTheDocument();
    expect(within(dialog).getByText(originalPlanText)).toBeInTheDocument();
  });

  it("calls onConfirm when the primary action is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        suggestion={suggestion}
        parsedPlan={parsedPlan}
        originalPlanText={originalPlanText}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /создать/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmModal
        suggestion={suggestion}
        parsedPlan={parsedPlan}
        originalPlanText={originalPlanText}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: /отмена/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons and shows a pending label while submitting", () => {
    render(
      <ConfirmModal
        suggestion={suggestion}
        parsedPlan={parsedPlan}
        originalPlanText={originalPlanText}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        submitting
      />,
    );

    expect(screen.getByRole("button", { name: /создаю/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /отмена/i })).toBeDisabled();
  });

  it("shows an error message when error is provided", () => {
    render(
      <ConfirmModal
        suggestion={suggestion}
        parsedPlan={parsedPlan}
        originalPlanText={originalPlanText}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        error="Не удалось создать событие"
      />,
    );

    expect(screen.getByTestId("confirm-error")).toHaveTextContent("Не удалось создать событие");
  });
});
