import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { useToasts, type Toast } from "./useToasts.js";

function TestHarness({
  toasts,
  push,
  dismiss,
}: {
  toasts: Toast[];
  push: (message: string, tone: Toast["tone"], action?: Toast["action"]) => void;
  dismiss: (id: number) => void;
}) {
  return (
    <div>
      <button
        data-testid="push-success"
        onClick={() =>
          push("Saved", "success", { label: "Undo", onClick: vi.fn() })
        }
      >
        Push success
      </button>
      <button data-testid="push-error" onClick={() => push("Failed", "error")}>
        Push error
      </button>
      <button data-testid="dismiss-first" onClick={() => toasts[0] && dismiss(toasts[0].id)}>
        Dismiss first
      </button>
      <div data-testid="toast-count">{toasts.length}</div>
      {toasts.map((t) => (
        <div key={t.id} data-testid={`toast-${t.tone}`}>
          <span data-testid="toast-message">{t.message}</span>
          {t.action && (
            <button data-testid="toast-action" onClick={t.action.onClick}>
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function Setup() {
  const { toasts, pushToast, dismissToast } = useToasts();
  return <TestHarness toasts={toasts} push={pushToast} dismiss={dismissToast} />;
}

describe("useToasts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a toast with an action button", () => {
    render(<Setup />);
    fireEvent.click(screen.getByTestId("push-success"));
    expect(screen.getByTestId("toast-success")).toBeInTheDocument();
    expect(screen.getByTestId("toast-message")).toHaveTextContent("Saved");
    expect(screen.getByTestId("toast-action")).toHaveTextContent("Undo");
  });

  it("calls the action callback when the action button is clicked", () => {
    const onAction = vi.fn();
    render(
      <TestHarness
        toasts={[
          {
            id: 1,
            message: "Saved",
            tone: "success",
            action: { label: "Undo", onClick: onAction },
          },
        ]}
        push={() => {}}
        dismiss={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("toast-action"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("removes the toast after 5 seconds", () => {
    render(<Setup />);
    fireEvent.click(screen.getByTestId("push-success"));
    expect(screen.getByTestId("toast-count")).toHaveTextContent("1");
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByTestId("toast-count")).toHaveTextContent("1");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("toast-count")).toHaveTextContent("0");
  });

  it("removes the toast via dismissToast", () => {
    render(<Setup />);
    fireEvent.click(screen.getByTestId("push-success"));
    fireEvent.click(screen.getByTestId("push-error"));
    expect(screen.getByTestId("toast-count")).toHaveTextContent("2");
    fireEvent.click(screen.getByTestId("dismiss-first"));
    expect(screen.getByTestId("toast-count")).toHaveTextContent("1");
    expect(screen.queryByTestId("toast-success")).not.toBeInTheDocument();
    expect(screen.getByTestId("toast-error")).toBeInTheDocument();
  });
});
