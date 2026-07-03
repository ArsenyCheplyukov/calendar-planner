import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { usePlanSubmission } from "./usePlanSubmission.js";

describe("usePlanSubmission", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-07-08T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const parsedPlan = {
    title: "Подготовить презентацию",
    durationMinutes: 60,
    type: "focus" as const,
    deadline: null,
    hint: null,
  };

  const suggestions = [
    {
      start: "2026-07-08T09:00:00.000Z",
      end: "2026-07-08T10:00:00.000Z",
      score: 0.8,
      reason: "ср 09:00–10:00, 60 мин (фокус)",
    },
  ];

  function mockPlanResponse(body: unknown) {
    return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/plan") && init?.method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }),
        );
      }
      return Promise.reject(new Error("unexpected: " + url));
    });
  }

  it("submits a plan and stores the response", async () => {
    vi.stubGlobal("fetch", mockPlanResponse({ parsed: parsedPlan, suggestions }));

    const { result } = renderHook(() => usePlanSubmission());
    let submitResult: Awaited<ReturnType<typeof result.current.handlePlanSubmit>> | null = null;

    await act(async () => {
      submitResult = await result.current.handlePlanSubmit("подготовить презентацию");
    });

    expect(submitResult).toEqual({ parsed: parsedPlan });
    expect(result.current.planState.kind).toBe("ready");
    if (result.current.planState.kind === "ready") {
      expect(result.current.planState.suggestions).toHaveLength(1);
      expect(result.current.planState.originalText).toBe("подготовить презентацию");
    }
  });

  it("switches suggestions when a candidate is selected", async () => {
    const candidate1 = {
      candidateId: "candidate-1",
      rank: 1,
      parsedPlan: { ...parsedPlan, title: "Фокус в понедельник", hint: { window: { dayOfWeek: "mon" as const } } },
      suggestions: [
        { start: "2026-07-06T09:00:00.000Z", end: "2026-07-06T10:00:00.000Z", score: 0.8, reason: "пн" },
      ],
    };
    const candidate2 = {
      candidateId: "candidate-2",
      rank: 2,
      parsedPlan: { ...parsedPlan, title: "Фокус в среду", hint: { window: { dayOfWeek: "wed" as const } } },
      suggestions: [
        { start: "2026-07-08T09:00:00.000Z", end: "2026-07-08T10:00:00.000Z", score: 0.75, reason: "ср" },
      ],
    };

    vi.stubGlobal(
      "fetch",
      mockPlanResponse({
        candidates: [candidate1, candidate2],
        selectedCandidateId: candidate1.candidateId,
        parsed: candidate1.parsedPlan,
        suggestions: candidate1.suggestions,
      }),
    );

    const { result } = renderHook(() => usePlanSubmission());

    await act(async () => {
      await result.current.handlePlanSubmit("подготовить презентацию");
    });

    expect(result.current.planState.kind).toBe("ready");
    if (result.current.planState.kind !== "ready") return;
    expect(result.current.planState.selectedCandidateId).toBe("candidate-1");
    expect(result.current.planState.suggestions[0]?.reason).toBe("пн");

    act(() => {
      result.current.handleCandidateSelect("candidate-2");
    });

    await waitFor(() => {
      if (result.current.planState.kind !== "ready") return;
      expect(result.current.planState.selectedCandidateId).toBe("candidate-2");
      expect(result.current.planState.suggestions[0]?.reason).toBe("ср");
    });
  });
});
