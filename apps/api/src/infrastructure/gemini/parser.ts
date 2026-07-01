import type { ParsedPlan, EventType, TimeOfDay } from "@calendar-planner/shared";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_INSTRUCTION = `Ты — ассистент по планированию. Тебе дают свободный текст на русском, описывающий что пользователь хочет запланировать. Твоя задача — извлечь из текста структурированные поля.

Верни JSON строго по схеме. Никаких пояснений, никакого текста вне JSON.

Правила:
- title: краткое название (на русском), до 60 символов. Без кавычек.
- durationMinutes: целое число минут. По умолчанию 60, если в тексте не указано иное.
- type: одно из "focus" | "meeting" | "personal" | "errand". Определи по смыслу:
  - focus: глубокая работа, кодинг, письмо, подготовка материалов
  - meeting: встреча, созвон, синк, 1-1
  - personal: личное (спорт, обед, отдых)
  - errand: поручение, бытовое дело, покупка
- deadline: ISO 8601 datetime в UTC, если в тексте указано «к <времени>», «до <даты>», «к <событию>». Иначе null.
- hint: null или объект { window: { ... } } если в тексте указано временное окно:
  - dayOfWeek: одно из "mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun", если упомянут день недели
  - timeOfDay: одно из "morning"|"midday"|"evening", если упомянуто время суток
  - date: ISO дата (YYYY-MM-DD), если упомянута конкретная дата

Примеры:
- "подготовить презентацию к встрече в пятницу, часа 2"
  → {"title":"Подготовить презентацию","durationMinutes":120,"type":"focus","deadline":"<ближайшая пятница>","hint":{"window":{"dayOfWeek":"fri"}}}
- "созвон с клиентом завтра в 15:00, минут 30"
  → {"title":"Созвон с клиентом","durationMinutes":30,"type":"meeting","deadline":"<завтра 15:00 UTC>","hint":null}
- "купить продукты"
  → {"title":"Купить продукты","durationMinutes":60,"type":"errand","deadline":null,"hint":null}`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    durationMinutes: { type: "integer" },
    type: {
      type: "string",
      enum: ["focus", "meeting", "personal", "errand"],
    },
    deadline: { type: "string", nullable: true },
    hint: {
      type: "object",
      nullable: true,
      properties: {
        window: {
          type: "object",
          nullable: true,
          properties: {
            dayOfWeek: {
              type: "string",
              nullable: true,
              enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
            },
            timeOfDay: {
              type: "string",
              nullable: true,
              enum: ["morning", "midday", "evening"],
            },
            date: { type: "string", nullable: true },
          },
        },
      },
    },
  },
  required: ["title", "durationMinutes", "type", "deadline", "hint"],
} as const;

export interface ParsePlanOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export async function parsePlan(
  text: string,
  options: ParsePlanOptions,
): Promise<ParsedPlan> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${GEMINI_URL}?key=${encodeURIComponent(options.apiKey)}`;

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const textOut = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOut) {
    throw new Error("Gemini returned no content");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(textOut);
  } catch {
    throw new Error("Gemini returned non-JSON content");
  }

  return validateParsedPlan(raw);
}

const VALID_TYPES: readonly EventType[] = ["focus", "meeting", "personal", "errand"];
const VALID_TIME_OF_DAY: readonly TimeOfDay[] = ["morning", "midday", "evening"];
const VALID_DAY_OF_WEEK = [
  "mon", "tue", "wed", "thu", "fri", "sat", "sun",
] as const;

export function validateParsedPlan(raw: unknown): ParsedPlan {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("parsePlan: expected object, got " + typeof raw);
  }
  const r = raw as Record<string, unknown>;

  if (typeof r["title"] !== "string" || r["title"].length === 0) {
    throw new Error("parsePlan: missing or empty title");
  }
  if (typeof r["durationMinutes"] !== "number" || !Number.isInteger(r["durationMinutes"])) {
    throw new Error("parsePlan: missing or non-integer durationMinutes");
  }
  if (typeof r["type"] !== "string" || !VALID_TYPES.includes(r["type"] as EventType)) {
    throw new Error(
      `parsePlan: invalid type "${String(r["type"])}", must be one of ${VALID_TYPES.join(", ")}`,
    );
  }

  const deadline = r["deadline"];
  if (deadline !== null && deadline !== undefined && typeof deadline !== "string") {
    throw new Error("parsePlan: deadline must be string or null");
  }

  const hint = r["hint"];
  let validatedHint: ParsedPlan["hint"];
  if (hint !== null && hint !== undefined) {
    if (typeof hint !== "object") {
      throw new Error("parsePlan: hint must be object or null");
    }
    const h = hint as Record<string, unknown>;
    const windowRaw = h["window"];
    if (windowRaw === null || windowRaw === undefined) {
      validatedHint = {};
    } else {
      if (typeof windowRaw !== "object") {
        throw new Error("parsePlan: hint.window must be object or null");
      }
      const w = windowRaw as Record<string, unknown>;
      const window: NonNullable<ParsedPlan["hint"]>["window"] = {};
      if (w["dayOfWeek"] !== null && w["dayOfWeek"] !== undefined) {
        if (typeof w["dayOfWeek"] !== "string" || !VALID_DAY_OF_WEEK.includes(w["dayOfWeek"] as typeof VALID_DAY_OF_WEEK[number])) {
          throw new Error(`parsePlan: invalid dayOfWeek "${String(w["dayOfWeek"])}"`);
        }
        window.dayOfWeek = w["dayOfWeek"] as typeof VALID_DAY_OF_WEEK[number];
      }
      if (w["timeOfDay"] !== null && w["timeOfDay"] !== undefined) {
        if (typeof w["timeOfDay"] !== "string" || !VALID_TIME_OF_DAY.includes(w["timeOfDay"] as TimeOfDay)) {
          throw new Error(`parsePlan: invalid timeOfDay "${String(w["timeOfDay"])}"`);
        }
        window.timeOfDay = w["timeOfDay"] as TimeOfDay;
      }
      if (w["date"] !== null && w["date"] !== undefined) {
        if (typeof w["date"] !== "string") {
          throw new Error("parsePlan: window.date must be string or null");
        }
        window.date = w["date"];
      }
      validatedHint = { window };
    }
  }

  return {
    title: r["title"],
    durationMinutes: r["durationMinutes"],
    type: r["type"] as EventType,
    deadline: (deadline as string | null | undefined) ?? null,
    hint: validatedHint ?? null,
  };
}
