import type { ParsedPlan, EventType, TimeOfDay } from "@calendar-planner/shared";
import { getLocalTimeZone, ymdInTimeZone } from "@calendar-planner/shared";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function buildSystemInstruction(today: string, timeZone: string): string {
  return `Ты — ассистент по планированию. Тебе дают свободный текст на русском, описывающий что пользователь хочет запланировать. Твоя задача — извлечь из текста структурированные поля.

Сегодняшняя дата: ${today}. Часовой пояс по умолчанию: ${timeZone}. Используй их для относительных ссылок: "сегодня" → ${today}, "завтра" → следующий день после ${today}, дни недели — ближайший будущий такой день.

Верни JSON строго по схеме. Никаких пояснений, никакого текста вне JSON.

Правила:
- title: краткое название (на русском), до 60 символов. Без кавычек.
- durationMinutes: целое число минут. По умолчанию 60, если в тексте не указано иное.
- bufferBeforeMinutes: целое число минут подготовки/буфера перед событием. Если не указано — null.
- bufferAfterMinutes: целое число минут буфера после события. Если не указано — null.
- type: одно из "focus" | "meeting" | "personal" | "errand". Определи по смыслу:
  - focus: глубокая работа, кодинг, письмо, подготовка материалов
  - meeting: встреча, созвон, синк, 1-1
  - personal: личное (спорт, обед, отдых)
  - errand: поручение, бытовое дело, покупка
- deadline: ISO 8601 datetime с timezone offset (например "2026-07-10T15:00:00+03:00"). Если пользователь не указал часовой пояс явно, используй ${timeZone}. Если указал другой пояс/город/страну — используй его. Иначе null.
- hint: null или объект { window: { ... } } если в тексте указано временное окно:
  - dayOfWeek: одно из "mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun", если упомянут день недели
  - timeOfDay: одно из "morning"|"midday"|"evening", если упомянуто только общее время суток
  - date: ISO дата (YYYY-MM-DD) в ${timeZone}, если упомянута конкретная дата
  - time: конкретное время начала в формате "HH:MM" (24-часовое), если указано точное время, например "в 16:00" или "в 16 часов"

Примеры:
- "подготовить презентацию к встрече в пятницу, часа 2"
  → {"title":"Подготовить презентацию","durationMinutes":120,"bufferBeforeMinutes":null,"bufferAfterMinutes":null,"type":"focus","deadline":null,"hint":{"window":{"dayOfWeek":"fri"}}}
- "созвон с клиентом завтра в 15:00, минут 30"
  → {"title":"Созвон с клиентом","durationMinutes":30,"bufferBeforeMinutes":null,"bufferAfterMinutes":null,"type":"meeting","deadline":null,"hint":{"window":{"date":"<завтра в ${timeZone} YYYY-MM-DD>","time":"15:00"}}}
- "купить продукты"
  → {"title":"Купить продукты","durationMinutes":60,"bufferBeforeMinutes":null,"bufferAfterMinutes":null,"type":"errand","deadline":null,"hint":null}
- "встреча 1 час с 15 минут до и после"
  → {"title":"Встреча","durationMinutes":60,"bufferBeforeMinutes":15,"bufferAfterMinutes":15,"type":"meeting","deadline":null,"hint":null}`;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    durationMinutes: { type: "integer" },
    bufferBeforeMinutes: { type: "integer", nullable: true },
    bufferAfterMinutes: { type: "integer", nullable: true },
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
            time: { type: "string", nullable: true },
          },
        },
      },
    },
  },
  required: ["title", "durationMinutes", "type", "deadline", "hint"],
} as const;

const MAX_CANDIDATES = 10;

const CANDIDATES_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      items: RESPONSE_SCHEMA,
      maxItems: MAX_CANDIDATES,
    },
  },
  required: ["candidates"],
} as const;

function buildCandidatesSystemInstruction(today: string, timeZone: string): string {
  return `${buildSystemInstruction(today, timeZone)}

Верни JSON строго по схеме с массивом candidates. Каждый элемент массива — ранжированная интерпретация плана (кандидат), отсортированная от наиболее вероятной к наименее вероятной.

- Если план однозначен (конкретная дата и время), верни ровно 1 кандидата.
- Если план неоднозначен по времени (например, "после 16:00", "до обеда", "вечером", "около 15:00"), верни 2–${MAX_CANDIDATES} кандидатов с разными конкретными временными окнами, расположенными через 30–60 минут друг от друга.
- Каждый кандидат должен быть полноценной интерпретацией плана, а не копией первого.`;
}

export interface ParsePlanOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  referenceDate?: Date;
  timeZone?: string;
}

interface GeminiRequestShape {
  systemInstruction: { parts: Array<{ text: string }> };
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  generationConfig: {
    temperature: number;
    responseMimeType: string;
    responseSchema: object;
    thinkingConfig: { thinkingBudget: number };
  };
}

interface GeminiExecutorOptions {
  apiKey: string;
  text: string;
  systemInstruction: string;
  responseSchema: object;
  fetchImpl?: typeof fetch;
  referenceDate?: Date;
  timeZone?: string;
}

async function executeGeminiParse(options: GeminiExecutorOptions): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${GEMINI_URL}?key=${encodeURIComponent(options.apiKey)}`;
  const timeZone = options.timeZone ?? getLocalTimeZone();
  const referenceDate = options.referenceDate ?? new Date();
  const today = ymdInTimeZone(timeZone, referenceDate);

  const body: GeminiRequestShape = {
    systemInstruction: { parts: [{ text: options.systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: options.text }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: options.responseSchema,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${errText}`);
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

  return raw;
}

export async function parsePlan(
  text: string,
  options: ParsePlanOptions,
): Promise<ParsedPlan> {
  const timeZone = options.timeZone ?? getLocalTimeZone();
  const referenceDate = options.referenceDate ?? new Date();
  const today = ymdInTimeZone(timeZone, referenceDate);

  const raw = await executeGeminiParse({
    apiKey: options.apiKey,
    text,
    systemInstruction: buildSystemInstruction(today, timeZone),
    responseSchema: RESPONSE_SCHEMA,
    fetchImpl: options.fetchImpl,
    referenceDate,
    timeZone,
  });

  return validateParsedPlan(raw);
}

export async function parsePlanCandidates(
  text: string,
  options: ParsePlanOptions,
): Promise<ParsedPlan[]> {
  const timeZone = options.timeZone ?? getLocalTimeZone();
  const referenceDate = options.referenceDate ?? new Date();
  const today = ymdInTimeZone(timeZone, referenceDate);

  const raw = await executeGeminiParse({
    apiKey: options.apiKey,
    text,
    systemInstruction: buildCandidatesSystemInstruction(today, timeZone),
    responseSchema: CANDIDATES_RESPONSE_SCHEMA,
    fetchImpl: options.fetchImpl,
    referenceDate,
    timeZone,
  });

  if (typeof raw !== "object" || raw === null || !("candidates" in raw)) {
    throw new Error("parsePlanCandidates: expected object with candidates array");
  }

  const list = (raw as { candidates: unknown }).candidates;
  if (!Array.isArray(list)) {
    throw new Error("parsePlanCandidates: candidates must be an array");
  }

  const validated = list.flatMap((item) => {
    try {
      return [validateParsedPlan(item)];
    } catch {
      return [];
    }
  });

  if (validated.length === 0) {
    throw new Error("parsePlanCandidates: all candidates failed validation");
  }

  return validated.slice(0, MAX_CANDIDATES);
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
  const bufferBefore = r["bufferBeforeMinutes"];
  if (bufferBefore !== null && bufferBefore !== undefined && (!Number.isInteger(bufferBefore) || (bufferBefore as number) < 0)) {
    throw new Error("parsePlan: bufferBeforeMinutes must be a non-negative integer or null");
  }
  const bufferAfter = r["bufferAfterMinutes"];
  if (bufferAfter !== null && bufferAfter !== undefined && (!Number.isInteger(bufferAfter) || (bufferAfter as number) < 0)) {
    throw new Error("parsePlan: bufferAfterMinutes must be a non-negative integer or null");
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
      if (w["time"] !== null && w["time"] !== undefined) {
        if (typeof w["time"] !== "string" || !/^\d{2}:\d{2}$/.test(w["time"])) {
          throw new Error(`parsePlan: invalid window.time "${String(w["time"])}"`);
        }
        window.time = w["time"];
      }
      validatedHint = { window };
    }
  }

  return {
    title: r["title"],
    durationMinutes: r["durationMinutes"],
    bufferBeforeMinutes: (bufferBefore as number | null | undefined) ?? null,
    bufferAfterMinutes: (bufferAfter as number | null | undefined) ?? null,
    type: r["type"] as EventType,
    deadline: (deadline as string | null | undefined) ?? null,
    hint: validatedHint ?? null,
  };
}
