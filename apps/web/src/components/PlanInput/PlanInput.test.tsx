import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanInput, type PlanInputResult } from "./PlanInput.js";

function ControlledPlanInput({ onSubmit }: { onSubmit: (text: string) => Promise<PlanInputResult | null> }) {
  const [text, setText] = useState("");
  return (
    <PlanInput
      text={text}
      onTextChange={setText}
      onSubmit={onSubmit}
    />
  );
}

describe("PlanInput", () => {
  it("renders a textarea and a Suggest button", () => {
    const onSubmit = vi.fn().mockResolvedValue(null);
    render(<ControlledPlanInput onSubmit={onSubmit} />);

    expect(screen.getByRole("textbox", { name: /план/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /suggest/i })).toBeInTheDocument();
  });

  it("calls onSubmit with the textarea text when the button is clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ parsed: { title: "x" } });

    render(<ControlledPlanInput onSubmit={onSubmit} />);

    const textarea = screen.getByRole("textbox", { name: /план/i });
    await user.type(textarea, "prepare slides");
    await user.click(screen.getByRole("button", { name: /suggest/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith("prepare slides");
    });
  });

  it("does not call onSubmit when the text is empty or whitespace", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(null);

    render(<ControlledPlanInput onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /suggest/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows a loading state while onSubmit is in flight", async () => {
    const user = userEvent.setup();
    let resolveSubmit: (value: PlanInputResult | null) => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<PlanInputResult | null>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    render(<ControlledPlanInput onSubmit={onSubmit} />);
    await user.type(screen.getByRole("textbox", { name: /план/i }), "x");
    await user.click(screen.getByRole("button", { name: /suggest/i }));

    // Button text changes to "Thinking…" or similar while loading
    expect(screen.getByRole("button", { name: /думаю|обрабатываю|loading/i })).toBeInTheDocument();

    resolveSubmit({ parsed: { title: "x" } });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /suggest/i })).toBeInTheDocument();
    });
  });

  it("shows an error banner when onSubmit returns null with an error", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ error: "Не удалось распарсить план" });

    render(<ControlledPlanInput onSubmit={onSubmit} />);
    await user.type(screen.getByRole("textbox", { name: /план/i }), "x");
    await user.click(screen.getByRole("button", { name: /suggest/i }));

    expect(await screen.findByTestId("plan-error")).toHaveTextContent(
      "Не удалось распарсить план",
    );
  });
});
