import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DesignGallery } from "./DesignGallery.js";

describe("DesignGallery", () => {
  it("renders the page title", () => {
    render(<DesignGallery />);
    expect(
      screen.getByRole("heading", { name: /design system/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it("shows a color palette section with each primitive scale", () => {
    render(<DesignGallery />);
    const section = screen.getByTestId("section-colors");
    expect(section).toBeInTheDocument();
    expect(within(section).getByText(/warm-tinted neutrals/i)).toBeInTheDocument();
    expect(within(section).getAllByText(/terracotta/i).length).toBeGreaterThan(0);
  });

  it("shows a typography section", () => {
    render(<DesignGallery />);
    expect(screen.getByTestId("section-typography")).toBeInTheDocument();
  });

  it("shows a primitives section with each component", () => {
    render(<DesignGallery />);
    const section = screen.getByTestId("section-primitives");
    const buttons = within(section).getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3); // primary, secondary, ghost
  });

  it("shows a suggested-slot preview block", () => {
    render(<DesignGallery />);
    expect(screen.getByTestId("suggested-block")).toBeInTheDocument();
  });
});
