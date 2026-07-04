import { describe, it, expect, vi } from "vitest";
import { parsePlan, parsePlanCandidates } from "./parser.js";
import type { ParsedPlan } from "@calendar-planner/shared";

function buildGeminiResponse(parsed: unknown): Response {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            role: "model",
            parts: [{ text: JSON.stringify(parsed) }],
          },
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const VALID_PLAN: ParsedPlan = {
  title: "Подготовить презентацию",
  durationMinutes: 120,
  bufferBeforeMinutes: null,
  bufferAfterMinutes: null,
  type: "focus",
  deadline: "2026-07-10T17:00:00.000Z",
  hint: { window: { dayOfWeek: "thu", timeOfDay: "morning" } },
};

describe("parsePlan", () => {
  it("returns a parsed plan from a valid Gemini response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildGeminiResponse(VALID_PLAN));
    const result = await parsePlan("подготовить презентацию к пятнице, часа 2", {
      apiKey: "test-key",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result).toEqual(VALID_PLAN);

    // Verify the request was sent to Gemini with the expected model and config
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).toContain("gemini-2.5-flash");
    expect(url).toContain("key=test-key");
    const body = JSON.parse(init.body as string);
    expect(body.generationConfig.temperature).toBe(0);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.thinkingConfig.thinkingBudget).toBe(0);
    expect(body.generationConfig.responseSchema).toBeDefined();
  });

  it("uses a Russian-language system instruction", async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildGeminiResponse(VALID_PLAN));
    await parsePlan("test", { apiKey: "k", fetchImpl: fetchMock as unknown as typeof fetch });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.systemInstruction.parts[0].text).toMatch(/[а-яё]/i);
  });

  it("includes today's date in the system instruction so relative references resolve correctly", async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildGeminiResponse(VALID_PLAN));
    await parsePlan("test", { apiKey: "k", fetchImpl: fetchMock as unknown as typeof fetch });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    const instruction = body.systemInstruction.parts[0].text as string;
    expect(instruction).toMatch(/Сегодняшняя дата: \d{4}-\d{2}-\d{2}/);
  });

  it("throws a typed error when Gemini returns a shape mismatch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      buildGeminiResponse({ title: "missing everything else" }),
    );
    await expect(
      parsePlan("test", { apiKey: "k", fetchImpl: fetchMock as unknown as typeof fetch }),
    ).rejects.toThrow(/durationMinutes/);
  });

  it("extracts optional buffer fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      buildGeminiResponse({
        title: "Встреча",
        durationMinutes: 60,
        bufferBeforeMinutes: 15,
        bufferAfterMinutes: 30,
        type: "meeting",
        deadline: null,
        hint: null,
      }),
    );
    const result = await parsePlan("встреча 1 час с 15 минут до и 30 после", {
      apiKey: "k",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.bufferBeforeMinutes).toBe(15);
    expect(result.bufferAfterMinutes).toBe(30);
  });

  it("defaults missing buffer fields to null", async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildGeminiResponse(VALID_PLAN));
    const result = await parsePlan("test", {
      apiKey: "k",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.bufferBeforeMinutes).toBeNull();
    expect(result.bufferAfterMinutes).toBeNull();
  });

  it("rejects negative buffer values", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      buildGeminiResponse({
        title: "Встреча",
        durationMinutes: 60,
        bufferBeforeMinutes: -10,
        bufferAfterMinutes: null,
        type: "meeting",
        deadline: null,
        hint: null,
      }),
    );
    await expect(
      parsePlan("test", { apiKey: "k", fetchImpl: fetchMock as unknown as typeof fetch }),
    ).rejects.toThrow(/bufferBeforeMinutes/);
  });

  it("throws when the Gemini API call fails (non-2xx)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("internal error", { status: 500 }),
    );
    await expect(
      parsePlan("test", { apiKey: "k", fetchImpl: fetchMock as unknown as typeof fetch }),
    ).rejects.toThrow(/Gemini API error: 500/);
  });
});

describe("parsePlanCandidates", () => {
  it("returns ranked candidates from a multi-candidate Gemini response", async () => {
    const secondPlan: ParsedPlan = {
      title: "Встреча с клиентом",
      durationMinutes: 30,
      bufferBeforeMinutes: null,
      bufferAfterMinutes: null,
      type: "meeting",
      deadline: null,
      hint: { window: { dayOfWeek: "wed" } },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      buildGeminiResponse({ candidates: [VALID_PLAN, secondPlan] }),
    );

    const result = await parsePlanCandidates("подготовить презентацию", {
      apiKey: "test-key",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(VALID_PLAN);
    expect(result[1]).toEqual(secondPlan);

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body as string);
    expect(body.generationConfig.responseSchema).toBeDefined();
    expect(body.systemInstruction.parts[0].text).toMatch(/кандидат|интерпретаци/i);
  });
});
