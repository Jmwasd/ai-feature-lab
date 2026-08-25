import { describe, expect, it } from "vitest";

import { parseAnalyzeResponse, responseError } from "./analyze-response";

describe("parseAnalyzeResponse", () => {
  it("converts transport date strings into transactions and a query period", () => {
    const result = parseAnalyzeResponse({
      report: {},
      transactions: [
        {
          id: "tx-1",
          at: "2026-08-14T20:32:16.000Z",
          description: "테스트 가맹점",
          kind: "체크카드결제",
          amount: -39000,
          memo: "",
          balanceAfter: 6769423,
        },
      ],
      queryPeriod: { from: "2026-08-01T00:00:00.000Z", to: "2026-08-31T00:00:00.000Z" },
      llmCategories: { "테스트 가맹점": "식비" },
      summary: "요약",
    });

    expect(result).toMatchObject({
      llmCategories: { "테스트 가맹점": "식비" },
      summary: "요약",
      transactions: [{ id: "tx-1", amount: -39000 }],
    });
    expect(result?.transactions[0].at).toEqual(new Date("2026-08-14T20:32:16.000Z"));
    expect(result?.queryPeriod).toEqual({
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-31T00:00:00.000Z"),
    });
  });

  it("rejects invalid payload fields and returns only a safe API error message", () => {
    expect(
      parseAnalyzeResponse({
        report: {},
        transactions: [],
        queryPeriod: null,
        llmCategories: { "테스트 가맹점": "알 수 없는 카테고리" },
        summary: null,
      }),
    ).toBeNull();
    expect(responseError({ error: "사용자에게 보여 줄 오류" })).toBe("사용자에게 보여 줄 오류");
    expect(responseError({ detail: "서버 내부 정보" })).toBe("파일 분석 중 오류가 발생했습니다.");
  });
});
