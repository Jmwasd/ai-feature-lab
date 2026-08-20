import type { Category, Report } from "../types/report";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 10_000;

const CATEGORIES = [
  "식비",
  "카페",
  "배달",
  "식료품",
  "생활",
  "교통",
  "숙박",
  "문화",
  "의료",
  "수수료/기타",
  "미분류",
] as const satisfies readonly Category[];

const CATEGORY_SET = new Set<Category>(CATEGORIES);

/** 미분류 적요를 카테고리로 분류한다. 키가 없으면 빈 객체를 반환한다. */
export async function classifyMerchants(names: string[]): Promise<Record<string, Category>> {
  const merchantNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];

  if (merchantNames.length === 0 || !process.env.OPENAI_API_KEY) {
    return {};
  }

  const content = await requestCompletion([
    {
      role: "system",
      content:
        "Classify each Korean payment merchant description into exactly one allowed category. Do not infer payment amounts, dates, people, or accounts.",
    },
    {
      role: "user",
      content: [
        "Return a JSON object only. Its keys must be the merchant descriptions exactly as provided and its values must be allowed categories.",
        `Allowed categories: ${CATEGORIES.join(", ")}`,
        `Merchant descriptions: ${JSON.stringify(merchantNames)}`,
      ].join("\n\n"),
    },
  ], { response_format: { type: "json_object" } });

  const result = content ? parseJsonObject(content) : null;

  if (!result) {
    return {};
  }

  return merchantNames.reduce<Record<string, Category>>((categories, name) => {
    if (Object.prototype.hasOwnProperty.call(result, name)) {
      categories[name] = normalizeCategory(result[name]);
    }

    return categories;
  }, {});
}

/** 계산이 끝난 리포트를 문장 몇 줄로 옮긴다. 키가 없으면 null을 반환한다. */
export async function summarize(report: Report): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const content = await requestCompletion([
    {
      role: "system",
      content:
        "Write a concise Korean spending-report summary from the supplied aggregates. Never calculate, recalculate, modify, or introduce numeric values; use only the supplied values.",
    },
    {
      role: "user",
      content: [
        "Write two or three factual sentences. Do not request or mention account numbers, names, or raw transactions.",
        "The following values are calculated aggregates. Do not perform arithmetic on them:",
        JSON.stringify(summaryData(report)),
      ].join("\n\n"),
    },
  ]);

  return content?.trim() || null;
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface CompletionOptions {
  response_format?: { type: "json_object" };
}

async function requestCompletion(
  messages: ChatMessage[],
  options: CompletionOptions = {},
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0,
        ...options,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    return messageContent(await response.json());
  } catch {
    return null;
  }
}

function normalizeCategory(value: unknown): Category {
  return typeof value === "string" && CATEGORY_SET.has(value as Category)
    ? (value as Category)
    : "미분류";
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);

    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function messageContent(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return null;
  }

  const firstChoice = payload.choices[0];

  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return null;
  }

  return typeof firstChoice.message.content === "string" ? firstChoice.message.content : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function summaryData(report: Report) {
  return {
    periodDays: report.period.days,
    totalSpend: report.totalSpend,
    spendCount: report.spendCount,
    excludedCancels: report.excludedCancels,
    byCategory: report.byCategory,
    repeats: report.repeats,
    events: report.events,
    concentration: {
      topN: report.concentration.topN,
      amount: report.concentration.amount,
      ratio: report.concentration.ratio,
    },
    unclassified: report.unclassified,
    notes: report.notes,
  };
}
