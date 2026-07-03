import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanCandidates } from "./PlanCandidates.js";
import type { PlanCandidate } from "@calendar-planner/shared";

function makeCandidate(index: number, hint?: PlanCandidate["parsedPlan"]["hint"]): PlanCandidate {
  return {
    candidateId: `candidate-${index}`,
    rank: index,
    parsedPlan: {
      title: `Plan ${index}`,
      durationMinutes: 60,
      type: "focus",
      deadline: null,
      hint: hint ?? null,
    },
    suggestions: [],
  };
}

describe("PlanCandidates", () => {
  it("renders one item per candidate", () => {
    render(
      <PlanCandidates
        candidates={[makeCandidate(1), makeCandidate(2)]}
        selectedCandidateId="candidate-1"
        onSelect={() => {}}
      />,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("pre-selects the candidate matching selectedCandidateId", () => {
    render(
      <PlanCandidates
        candidates={[makeCandidate(1), makeCandidate(2)]}
        selectedCandidateId="candidate-2"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole("radio", { name: /Plan 2/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Plan 1/i })).not.toBeChecked();
  });

  it("calls onSelect with the candidate id when a candidate is selected", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <PlanCandidates
        candidates={[makeCandidate(1), makeCandidate(2)]}
        selectedCandidateId="candidate-1"
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("radio", { name: /Plan 2/i }));
    expect(onSelect).toHaveBeenCalledWith("candidate-2");
  });

  it("shows up to 10 candidates by default and expands when asked", async () => {
    const user = userEvent.setup();
    const candidates = Array.from({ length: 12 }, (_, i) => makeCandidate(i + 1));
    render(
      <PlanCandidates
        candidates={candidates}
        selectedCandidateId="candidate-1"
        onSelect={() => {}}
      />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(10);
    await user.click(screen.getByRole("button", { name: /show more/i }));
    expect(screen.getAllByRole("radio")).toHaveLength(12);
  });

  it("does not render when there is only one candidate", () => {
    const { container } = render(
      <PlanCandidates
        candidates={[makeCandidate(1)]}
        selectedCandidateId="candidate-1"
        onSelect={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
