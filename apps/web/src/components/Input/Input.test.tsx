import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./Input.js";

function ControlledInput({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <Input
      aria-label="Name"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        onChange?.(e.target.value);
      }}
    />
  );
}

describe("Input", () => {
  it("renders an <input> element", () => {
    render(<Input aria-label="Name" />);
    expect(screen.getByRole("textbox", { name: /name/i })).toBeInTheDocument();
  });

  it("forwards value and onChange", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<ControlledInput onChange={handleChange} />);

    const input = screen.getByRole("textbox", { name: /name/i });
    await user.type(input, "hi");
    expect(handleChange).toHaveBeenCalled();
    expect(input).toHaveValue("hi");
  });

  it("marks aria-invalid when invalid prop is set", () => {
    render(<Input aria-label="Name" invalid />);
    const input = screen.getByRole("textbox", { name: /name/i });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("data-invalid", "true");
  });

  it("renders placeholder when provided", () => {
    render(<Input aria-label="Name" placeholder="Type here" />);
    expect(screen.getByPlaceholderText(/type here/i)).toBeInTheDocument();
  });

  it("forwards ref to the underlying input element", () => {
    const ref = vi.fn();
    render(<Input ref={ref} aria-label="Name" />);
    expect(ref).toHaveBeenCalled();
    const node = ref.mock.calls[0]?.[0];
    expect(node?.tagName).toBe("INPUT");
  });
});
