import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Textarea } from "./Textarea.js";

function ControlledTextarea() {
  const [value, setValue] = useState("");
  return (
    <Textarea
      aria-label="Plan"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

describe("Textarea", () => {
  it("renders a <textarea> element", () => {
    render(<Textarea aria-label="Plan" />);
    expect(screen.getByRole("textbox", { name: /plan/i })).toBeInTheDocument();
  });

  it("forwards value and onChange", async () => {
    const user = userEvent.setup();
    render(<ControlledTextarea />);

    const textarea = screen.getByRole("textbox", { name: /plan/i });
    await user.type(textarea, "hello");
    expect(textarea).toHaveValue("hello");
  });

  it("marks aria-invalid when invalid prop is set", () => {
    render(<Textarea aria-label="Plan" invalid />);
    const textarea = screen.getByRole("textbox", { name: /plan/i });
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAttribute("data-invalid", "true");
  });

  it("accepts a placeholder", () => {
    render(<Textarea aria-label="Plan" placeholder="Type your plan" />);
    expect(screen.getByPlaceholderText(/type your plan/i)).toBeInTheDocument();
  });
});
