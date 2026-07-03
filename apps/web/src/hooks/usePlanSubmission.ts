import { useCallback, useState } from "react";
import { getLocalTimeZone } from "@calendar-planner/shared";
import type { Suggestion, ParsedPlan, PlanCandidate } from "@calendar-planner/shared";
import type { PlanInputResult } from "../components/PlanInput/index.js";

export type PlanState =
  | { kind: "idle" }
  | {
      kind: "ready";
      candidates: PlanCandidate[];
      selectedCandidateId: string;
      parsed: ParsedPlan;
      suggestions: Suggestion[];
      originalText: string;
    }
  | { kind: "error"; message: string };

export interface UsePlanSubmissionReturn {
  planText: string;
  setPlanText: (text: string) => void;
  planState: PlanState;
  handlePlanSubmit: (text: string) => Promise<PlanInputResult | null>;
  handleCandidateSelect: (candidateId: string) => void;
}

export function usePlanSubmission(): UsePlanSubmissionReturn {
  const [planText, setPlanText] = useState("");
  const [planState, setPlanState] = useState<PlanState>({ kind: "idle" });

  const handlePlanSubmit = useCallback(async (
    text: string,
  ): Promise<PlanInputResult | null> => {
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, timeZone: getLocalTimeZone() }),
      });
      if (res.status === 400) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        return { error: body.message ?? "Invalid plan" };
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        return { error: body.message ?? `HTTP ${res.status}` };
      }
      const body = (await res.json()) as {
        parsed: ParsedPlan;
        suggestions: Suggestion[];
        candidates?: PlanCandidate[];
        selectedCandidateId?: string;
      };
      const candidates: PlanCandidate[] =
        body.candidates && body.candidates.length > 0
          ? body.candidates
          : [
              {
                candidateId: "candidate-1",
                rank: 1,
                parsedPlan: body.parsed,
                suggestions: body.suggestions,
              },
            ];
      const selectedCandidateId = body.selectedCandidateId ?? candidates[0]!.candidateId;
      setPlanState({
        kind: "ready",
        candidates,
        selectedCandidateId,
        parsed: body.parsed,
        suggestions: body.suggestions,
        originalText: text,
      });
      return { parsed: body.parsed };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, []);

  const handleCandidateSelect = useCallback((candidateId: string) => {
    setPlanState((current) => {
      if (current.kind !== "ready") return current;
      const candidate = current.candidates.find((c) => c.candidateId === candidateId);
      if (!candidate) return current;
      return {
        ...current,
        selectedCandidateId: candidateId,
        parsed: candidate.parsedPlan,
        suggestions: candidate.suggestions,
      };
    });
  }, []);

  return { planText, setPlanText, planState, handlePlanSubmit, handleCandidateSelect };
}
