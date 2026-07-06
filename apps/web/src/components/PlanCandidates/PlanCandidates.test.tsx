import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanCandidates } from "./PlanCandidates.js";
import type { PlanCandidate, Suggestion } from "@calendar-planner/shared";

function makeSuggestion(start: string, end: string, score: number, reason: string): Suggestion {
  return { start, end, score, reason };
}

function makeCandidate(index: number, suggestion?: Suggestion): PlanCandidate {
  return {
    candidateId: `candidate-${index}`,
    rank: index,
    parsedPlan: {
      title: `Plan ${index}`,
      durationMinutes: 60,
      type: "focus",
      deadline: null,
      hint: null,
    },
    suggestions: suggestion ? [suggestion] : [],
  };
}

describe("PlanCandidates", () => {
  it("renders one card per candidate", () => {
    render(
      <PlanCandidates
        candidates={[makeCandidate(1), makeCandidate(2)]}
        selectedCandidateId="candidate-1"
        onSelect={() => {}}
      />,
    );
    expect(screen.getAllByTestId("plan-candidate-card")).toHaveLength(2);
  });

  it("marks the selected candidate", () => {
    render(
      <PlanCandidates
        candidates={[makeCandidate(1), makeCandidate(2)]}
        selectedCandidateId="candidate-2"
        onSelect={() => {}}
      />,
    );
    const cards = screen.getAllByTestId("plan-candidate-card");
    expect(cards[0]).toHaveAttribute("data-selected", "false");
    expect(cards[1]).toHaveAttribute("data-selected", "true");
  });

  it("calls onSelect when a card is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <PlanCandidates
        candidates={[makeCandidate(1), makeCandidate(2)]}
        selectedCandidateId="candidate-1"
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getAllByTestId("plan-candidate-card")[1]!);
    expect(onSelect).toHaveBeenCalledWith("candidate-2");
  });

  it("shows the top suggestion time, reason, and score on each card", () => {
    const candidates = [
      makeCandidate(1, makeSuggestion("2026-07-08T09:00:00.000Z", "2026-07-08T10:00:00.000Z", 0.85, "фокус")),
      makeCandidate(2, makeSuggestion("2026-07-08T10:00:00.000Z", "2026-07-08T11:00:00.000Z", 0.7, "фокус")),
    ];
    render(<PlanCandidates candidates={candidates} selectedCandidateId="candidate-1" onSelect={() => {}} />);

    const cards = screen.getAllByTestId("plan-candidate-card");
    expect(within(cards[0]!).getByTestId("candidate-time")).toHaveTextContent(/09:00/);
    expect(within(cards[0]!).getByText(/фокус/)).toBeInTheDocument();
    expect(within(cards[0]!).getByText(/85%/)).toBeInTheDocument();
  });

  it("calls onApprove with the candidate when Add event is clicked", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const candidates = [
      makeCandidate(1, makeSuggestion("2026-07-08T09:00:00.000Z", "2026-07-08T10:00:00.000Z", 0.85, "фокус")),
    ];
    render(<PlanCandidates candidates={candidates} selectedCandidateId="candidate-1" onSelect={() => {}} onApprove={onApprove} />);

    await user.click(screen.getByRole("button", { name: /add event/i }));
    expect(onApprove).toHaveBeenCalledWith(candidates[0]);
  });

  it("renders even when there is only one candidate", () => {
    render(
      <PlanCandidates
        candidates={[makeCandidate(1, makeSuggestion("2026-07-08T09:00:00.000Z", "2026-07-08T10:00:00.000Z", 0.85, "фокус"))]}
        selectedCandidateId="candidate-1"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByTestId("plan-candidates")).toBeInTheDocument();
  });
});
