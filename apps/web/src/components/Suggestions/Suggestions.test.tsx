import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suggestions, type SuggestionsList } from "./Suggestions.js";

const sample: SuggestionsList = [
  {
    start: "2026-07-08T09:00:00.000Z",
    end: "2026-07-08T10:00:00.000Z",
    score: 0.85,
    reason: "ср 09:00–10:00, 60 мин (фокус)",
  },
  {
    start: "2026-07-09T10:00:00.000Z",
    end: "2026-07-09T11:00:00.000Z",
    score: 0.7,
    reason: "чт 10:00–11:00, 60 мин (фокус)",
  },
  {
    start: "2026-07-10T11:00:00.000Z",
    end: "2026-07-10T12:00:00.000Z",
    score: 0.55,
    reason: "пт 11:00–12:00, 60 мин (фокус)",
  },
];

describe("Suggestions", () => {
  it("renders one card per suggestion", () => {
    render(<Suggestions suggestions={sample} onApprove={() => {}} onSelect={() => {}} />);
    const cards = screen.getAllByTestId("suggestion-card");
    expect(cards).toHaveLength(3);
  });

  it("shows the time, the reason, and an Add event button on each card", () => {
    render(<Suggestions suggestions={sample} onApprove={() => {}} onSelect={() => {}} />);
    const cards = screen.getAllByTestId("suggestion-card");

    expect(within(cards[0]!).getByTestId("suggestion-time")).toHaveTextContent(/09:00/);
    expect(within(cards[0]!).getByText(/фокус/)).toBeInTheDocument();
    expect(within(cards[0]!).getByRole("button", { name: /add event/i })).toBeInTheDocument();
  });

  it("calls onApprove with the suggestion when Add event is clicked", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    render(<Suggestions suggestions={sample} onApprove={onApprove} onSelect={() => {}} />);

    await user.click(screen.getAllByRole("button", { name: /add event/i })[0]!);
    expect(onApprove).toHaveBeenCalledWith(sample[0]);
  });

  it("calls onSelect when a card body (not the button) is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Suggestions suggestions={sample} onApprove={() => {}} onSelect={onSelect} />);

    await user.click(screen.getAllByTestId("suggestion-time")[0]!);
    expect(onSelect).toHaveBeenCalledWith(sample[0]);
  });

  it("renders an empty state when there are no suggestions", () => {
    render(<Suggestions suggestions={[]} onApprove={() => {}} onSelect={() => {}} />);
    expect(screen.getByTestId("suggestions-empty")).toBeInTheDocument();
  });
});
