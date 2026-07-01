import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Surface } from "./Surface.js";

describe("Surface", () => {
  it("renders a div container", () => {
    render(<Surface data-testid="surface">Content</Surface>);
    const surface = screen.getByTestId("surface");
    expect(surface.tagName).toBe("DIV");
  });

  it("renders its children", () => {
    render(
      <Surface>
        <span>Inner</span>
      </Surface>,
    );
    expect(screen.getByText("Inner")).toBeInTheDocument();
  });

  it("accepts an as prop to render a different element", () => {
    render(
      <Surface as="section" data-testid="surface">
        X
      </Surface>,
    );
    expect(screen.getByTestId("surface").tagName).toBe("SECTION");
  });
});
