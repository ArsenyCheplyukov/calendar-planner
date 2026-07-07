import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suggestions, type SuggestionsList } from "./Suggestions.js";
import type { BusyMap } from "@calendar-planner/shared";

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

  it("renders a Suggested badge on each card to distinguish it from existing events", () => {
    render(<Suggestions suggestions={sample} onApprove={() => {}} onSelect={() => {}} />);
    const cards = screen.getAllByTestId("suggestion-card");

    cards.forEach((card) => {
      expect(within(card).getByTestId("suggestion-badge")).toHaveTextContent(/suggested/i);
    });
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

  it("renders a conflict badge on suggestions that overlap a busy block", () => {
    const busy: BusyMap = {
      "2026-07-08": [{ start: "2026-07-08T09:30:00.000Z", end: "2026-07-08T10:30:00.000Z" }],
    };
    render(<Suggestions suggestions={sample} busy={busy} bufferMinutes={0} onApprove={() => {}} onSelect={() => {}} />);
    const cards = screen.getAllByTestId("suggestion-card");
    expect(within(cards[0]!).getByTestId("conflict-badge")).toHaveTextContent(/conflicts/i);
    expect(within(cards[1]!).queryByTestId("conflict-badge")).not.toBeInTheDocument();
  });

  it("does not render a conflict badge when the slot is outside the buffered busy interval", () => {
    const busy: BusyMap = {
      "2026-07-08": [{ start: "2026-07-08T07:00:00.000Z", end: "2026-07-08T08:30:00.000Z" }],
    };
    render(<Suggestions suggestions={[sample[0]!]} busy={busy} bufferMinutes={15} onApprove={() => {}} onSelect={() => {}} />);
    const cards = screen.getAllByTestId("suggestion-card");
    expect(within(cards[0]!).queryByTestId("conflict-badge")).not.toBeInTheDocument();
    expect(within(cards[0]!).getByTestId("suggestion-badge")).toBeInTheDocument();
  });

  it("renders a 'No clean slots found' banner when every suggestion conflicts", () => {
    const busy: BusyMap = {
      "2026-07-08": [{ start: "2026-07-08T09:00:00.000Z", end: "2026-07-08T10:00:00.000Z" }],
      "2026-07-09": [{ start: "2026-07-09T10:00:00.000Z", end: "2026-07-09T11:00:00.000Z" }],
      "2026-07-10": [{ start: "2026-07-10T11:00:00.000Z", end: "2026-07-10T12:00:00.000Z" }],
    };
    render(<Suggestions suggestions={sample} busy={busy} bufferMinutes={0} onApprove={() => {}} onSelect={() => {}} />);
    expect(screen.getByTestId("no-clean-slots")).toHaveTextContent(/no clean slots found/i);
  });

  it("does not render a 'No clean slots found' banner when at least one suggestion is clean", () => {
    const busy: BusyMap = {
      "2026-07-08": [{ start: "2026-07-08T09:00:00.000Z", end: "2026-07-08T10:00:00.000Z" }],
    };
    render(<Suggestions suggestions={sample} busy={busy} bufferMinutes={0} onApprove={() => {}} onSelect={() => {}} />);
    expect(screen.queryByTestId("no-clean-slots")).not.toBeInTheDocument();
  });
});
