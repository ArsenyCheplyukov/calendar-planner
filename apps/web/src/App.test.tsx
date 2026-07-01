import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { App } from "./App.js";

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the app shell with the title and a Card for API status", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    render(<App />);

    expect(screen.getByTestId("app")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /calendar planner/i })).toBeInTheDocument();
    expect(screen.getByTestId("api-status-card")).toBeInTheDocument();
    expect(screen.getByTestId("api-status-card")).toHaveAttribute("data-padding", "md");
    expect(screen.getByTestId("api-status-surface")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    render(<App />);
    expect(screen.getByTestId("status-loading")).toBeInTheDocument();
  });

  it("shows ok status when /api/health returns { status: 'ok' }", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ status: "ok" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("status-ok")).toHaveTextContent("ok");
    });
  });

  it("shows error state when /api/health fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network down"))),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("status-error")).toHaveTextContent("network down");
    });
  });
});
