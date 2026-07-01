import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button.js";

describe("Button", () => {
  it("renders a <button> element", () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe("BUTTON");
  });

  it("uses primary variant by default", () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "primary");
  });

  it("uses medium size by default", () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-size", "md");
  });

  it("renders secondary variant", () => {
    render(<Button variant="secondary">Cancel</Button>);
    expect(screen.getByRole("button", { name: /cancel/i })).toHaveAttribute(
      "data-variant",
      "secondary",
    );
  });

  it("renders ghost variant", () => {
    render(<Button variant="ghost">Skip</Button>);
    expect(screen.getByRole("button", { name: /skip/i })).toHaveAttribute(
      "data-variant",
      "ghost",
    );
  });

  it("renders size sm", () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button", { name: /small/i })).toHaveAttribute(
      "data-size",
      "sm",
    );
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<Button onClick={handleClick}>Go</Button>);

    await user.click(screen.getByRole("button", { name: /go/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
