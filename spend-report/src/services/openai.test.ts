import { afterEach, describe, expect, it, vi } from "vitest";
import type { Report } from "../types/report";
import { classifyMerchants, summarize } from "./openai";

const originalApiKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalApiKey;
  }

  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("OpenAI service", () => {
  it("returns safe empty results without an API key", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(classifyMerchants(["막불감동"])).resolves.toEqual({});
    await expect(summarize(report())).resolves.toBeNull();
  });

  it("does not expose network errors to callers", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));

    await expect(classifyMerchants(["막불감동"])).resolves.toEqual({});
    await expect(summarize(report())).resolves.toBeNull();
  });

  it("normalizes unsupported category values to 미분류", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    막불감동: "존재하지 않는 카테고리",
                    영광과일: "식비",
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(classifyMerchants(["막불감동", "영광과일"])).resolves.toEqual({
      막불감동: "미분류",
      영광과일: "식비",
    });
  });
});

function report(): Report {
  const from = new Date("2026-08-01T00:00:00.000Z");
  const to = new Date("2026-08-31T00:00:00.000Z");

  return {
    period: { from, to, days: 31 },
    totalSpend: 10000,
    spendCount: 1,
    excludedCancels: { count: 0, amount: 0 },
    byCategory: [{ category: "식비", amount: 10000, count: 1 }],
    repeats: [],
    events: [],
    concentration: { topN: 1, amount: 10000, ratio: 1, items: [] },
    unclassified: { count: 0, amount: 0, ratio: 0 },
    needsInput: [],
    notes: [],
  };
}
