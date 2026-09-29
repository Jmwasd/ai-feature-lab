import { describe, expect, it } from "vitest";
import { deserializeJudgmentView, serializeJudgmentView, SERIALIZED_VIEW_VERSION } from "./serialize";
import { ALL_VIEWS, allSignalsView, noSignalsView } from "./ui/__fixtures__/views";

describe("serializeJudgmentView / deserializeJudgmentView", () => {
  it.each(Object.entries(ALL_VIEWS))("%s: 왕복 변환하면 같은 값이 된다", (_, view) => {
    expect(deserializeJudgmentView(serializeJudgmentView(view))).toEqual(view);
  });

  it("version 1 필드를 둔다", () => {
    const serialized = serializeJudgmentView(noSignalsView);
    expect(SERIALIZED_VIEW_VERSION).toBe(1);
    expect(serialized.version).toBe(1);
  });

  it("Date를 ISO 문자열로 바꾸고 JSON 왕복 뒤에도 복원된다", () => {
    const serialized = serializeJudgmentView(noSignalsView);
    expect(serialized.report.dataBaseDate).toBe(noSignalsView.report.dataBaseDate.toISOString());
    expect(serialized.priceEstimate.periodFrom).toBe(noSignalsView.priceEstimate.periodFrom.toISOString());
    expect(serialized.priceEstimate.comparables[0]?.contractDate).toBe(
      noSignalsView.priceEstimate.comparables[0]?.contractDate.toISOString(),
    );
    expect(serialized.rights.lastOwnershipChangeDate).toBe(
      noSignalsView.rights.lastOwnershipChangeDate?.toISOString(),
    );

    const viaJson = JSON.parse(JSON.stringify(serialized)) as typeof serialized;
    expect(deserializeJudgmentView(viaJson)).toEqual(noSignalsView);
  });

  it("소유권 이전일이 null이면 null로 유지한다", () => {
    const view = { ...allSignalsView, rights: { ...allSignalsView.rights, lastOwnershipChangeDate: null } };
    const serialized = serializeJudgmentView(view);
    expect(serialized.rights.lastOwnershipChangeDate).toBeNull();
    expect(deserializeJudgmentView(serialized).rights.lastOwnershipChangeDate).toBeNull();
  });

  it("뷰에 없는 필드(runJudgment의 warnings)는 싣지 않는다", () => {
    const serialized = serializeJudgmentView({ ...noSignalsView, warnings: [{ kind: "building-unavailable" }] } as never);
    expect(serialized).not.toHaveProperty("warnings");
  });

  it("알 수 없는 버전이면 예외를 던진다", () => {
    const serialized = { ...serializeJudgmentView(noSignalsView), version: 2 };
    expect(() => deserializeJudgmentView(serialized as never)).toThrow();
  });

  it("날짜 문자열이 올바르지 않으면 예외를 던진다", () => {
    const serialized = serializeJudgmentView(noSignalsView);
    const broken = { ...serialized, report: { ...serialized.report, dataBaseDate: "not-a-date" } };
    expect(() => deserializeJudgmentView(broken)).toThrow();
  });
});
