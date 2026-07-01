import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card.js";

describe("Card", () => {
  it("renders a div container", () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId("card");
    expect(card.tagName).toBe("DIV");
  });

  it("uses medium padding by default", () => {
    render(<Card data-testid="card">X</Card>);
    expect(screen.getByTestId("card")).toHaveAttribute("data-padding", "md");
  });

  it("accepts padding variants", () => {
    render(
      <>
        <Card data-testid="c-sm" padding="sm">a</Card>
        <Card data-testid="c-md" padding="md">b</Card>
        <Card data-testid="c-lg" padding="lg">c</Card>
      </>,
    );
    expect(screen.getByTestId("c-sm")).toHaveAttribute("data-padding", "sm");
    expect(screen.getByTestId("c-md")).toHaveAttribute("data-padding", "md");
    expect(screen.getByTestId("c-lg")).toHaveAttribute("data-padding", "lg");
  });

  it("is not elevated by default", () => {
    render(<Card data-testid="card">X</Card>);
    expect(screen.getByTestId("card")).not.toHaveAttribute("data-elevated");
  });

  it("can be elevated", () => {
    render(
      <Card data-testid="card" elevated>
        X
      </Card>,
    );
    expect(screen.getByTestId("card")).toHaveAttribute("data-elevated", "true");
  });
});
