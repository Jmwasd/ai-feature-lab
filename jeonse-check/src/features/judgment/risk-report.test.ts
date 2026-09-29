import { describe, expect, it } from "vitest";
import { PRICE_ESTIMATE, RISK_SIGNAL } from "@/consts/policy";
import * as copy from "./copy";
import type { PriceEstimate } from "./price-estimate";
import { checkHugEligibility, debtRatio, jeonseRatio } from "./ratios";
import { buildRiskReport, type RiskReport, type RiskSignalCode } from "./risk-report";
import type { BuildingInfo, RightsInput } from "./types";

// 출처: docs/UI_GUIDE.md §6 "금지 표현" 목록. 원본 목록이 바뀌면 여기도 함께 고친다.
const FORBIDDEN_PHRASES = ["안전", "안정", "양호", "문제없음", "괜찮", "위험 낮음"];

const asOf = new Date("2026-09-29T00:00:00Z");
const dataBaseDate = new Date("2026-09-01T00:00:00Z");
const price = 300_000_000;
const deposit = 150_000_000; // 전세가율 50%

type Input = Parameters<typeof buildRiskReport>[0];

function estimate(overrides: Partial<PriceEstimate> = {}): PriceEstimate {
  return {
    price,
    method: "same-building",
    confidence: "high",
    comparables: [],
    periodFrom: new Date("2025-09-29T00:00:00Z"),
    periodTo: asOf,
    ...overrides,
  };
}

const normalBuilding: BuildingInfo = {
  mainPurpose: "공동주택",
  isViolation: false,
  useApprovalDate: new Date("2010-05-01T00:00:00Z"),
};

const normalRights: RightsInput = {
  maxClaimAmount: 0,
  seniorDeposits: 0,
  isTrust: false,
  lastOwnershipChangeDate: new Date("2020-01-01T00:00:00Z"),
};

function normalInput(): Input {
  return {
    deposit,
    priceEstimate: estimate(),
    jeonseRatio: jeonseRatio(deposit, price),
    debtRatio: debtRatio({ deposit, maxClaimAmount: 0, seniorDeposits: 0, estimatedPrice: price }),
    hug: { eligible: true, reasons: [] },
    building: normalBuilding,
    rights: normalRights,
    asOf,
    dataBaseDate,
  };
}

function build(overrides: Partial<Input> = {}): RiskReport {
  return buildRiskReport({ ...normalInput(), ...overrides });
}

function codes(report: RiskReport): RiskSignalCode[] {
  return report.signals.map((s) => s.code);
}

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

// 신호가 가능한 한 많이 켜진 보고서들. 상호 배타적인 신호(caution/danger, low-confidence/unavailable)는
// 두 보고서에 나눠 담아 모든 코드가 한 번 이상 나오게 한다.
function allSignalReports(): RiskReport[] {
  const riskyBuilding: BuildingInfo = {
    mainPurpose: "제2종근린생활시설",
    isViolation: true,
    useApprovalDate: daysBefore(asOf, 30),
  };
  const riskyRights: RightsInput = {
    maxClaimAmount: 100_000_000,
    seniorDeposits: 50_000_000,
    isTrust: true,
    lastOwnershipChangeDate: daysBefore(asOf, 10),
  };
  const dangerDeposit = 260_000_000;
  const danger = buildRiskReport({
    deposit: dangerDeposit,
    priceEstimate: estimate({ method: "official-price", confidence: "low" }),
    jeonseRatio: jeonseRatio(dangerDeposit, price),
    debtRatio: debtRatio({
      deposit: dangerDeposit,
      maxClaimAmount: riskyRights.maxClaimAmount,
      seniorDeposits: riskyRights.seniorDeposits,
      estimatedPrice: price,
    }),
    hug: checkHugEligibility({
      deposit: 800_000_000,
      seniorDebt: 150_000_000,
      officialPrice: 200_000_000,
      isCapitalArea: true,
    }),
    building: riskyBuilding,
    rights: riskyRights,
    asOf,
    dataBaseDate,
  });

  const cautionDeposit = 222_000_000; // 74%
  const caution = buildRiskReport({
    deposit: cautionDeposit,
    priceEstimate: estimate({ price: null, method: "none", confidence: "none" }),
    jeonseRatio: jeonseRatio(cautionDeposit, price),
    debtRatio: debtRatio({
      deposit: cautionDeposit,
      maxClaimAmount: 0,
      seniorDeposits: 0,
      estimatedPrice: price,
    }),
    hug: checkHugEligibility({
      deposit: cautionDeposit,
      seniorDebt: 0,
      officialPrice: null,
      isCapitalArea: false,
    }),
    building: riskyBuilding,
    rights: riskyRights,
    asOf,
    dataBaseDate,
  });
  return [danger, caution];
}

function reportStrings(report: RiskReport): string[] {
  return [
    report.headline,
    report.disclaimer,
    ...report.notes,
    ...report.sources,
    ...report.signals.flatMap((s) => [s.title, s.detail]),
  ];
}

function expectNoForbidden(text: string) {
  for (const phrase of FORBIDDEN_PHRASES) {
    expect(text, `"${phrase}" 포함: ${text}`).not.toContain(phrase);
  }
}

describe("buildRiskReport — 정상 입력", () => {
  it("모든 입력이 정상이면 신호 0개, headline은 '위험 신호 0개'다", () => {
    const report = build();
    expect(report.signals).toEqual([]);
    expect(report.signalCount).toBe(0);
    expect(report.headline).toBe("위험 신호 0개");
  });

  it("dataBaseDate를 그대로 담고, 출처 네 항목을 항상 넣는다", () => {
    const report = build();
    expect(report.dataBaseDate).toBe(dataBaseDate);
    expect(report.sources).toEqual([
      "국토교통부 실거래가",
      "공동주택 공시가격",
      "건축물대장",
      "사용자 입력(등기부)",
    ]);
    expect(report.disclaimer).toBe(copy.DISCLAIMER);
  });

  it("신고 지연 안내가 notes에 항상 있다", () => {
    const expected = copy.reportingDelayNote(PRICE_ESTIMATE.reportingDelayDays);
    expect(expected).toContain(String(PRICE_ESTIMATE.reportingDelayDays));
    expect(build().notes).toContain(expected);
    for (const report of allSignalReports()) expect(report.notes).toContain(expected);
  });

  it("signalCount와 headline은 신호 수를 따른다", () => {
    for (const report of allSignalReports()) {
      expect(report.signalCount).toBe(report.signals.length);
      expect(report.headline).toBe(`위험 신호 ${report.signals.length}개`);
    }
  });
});

describe("buildRiskReport — 전세가율·부채비율", () => {
  it.each([
    ["caution", "jeonse-ratio-caution"],
    ["danger", "jeonse-ratio-danger"],
  ] as const)("전세가율 %s면 %s 신호 1개", (level, code) => {
    const report = build({ jeonseRatio: { ratio: 0.85, level } });
    expect(codes(report)).toEqual([code]);
    expect(report.signals[0].level).toBe(level);
  });

  it.each([
    ["caution", "debt-ratio-caution"],
    ["danger", "debt-ratio-danger"],
  ] as const)("부채비율 %s면 %s 신호 1개", (level, code) => {
    const report = build({ debtRatio: { ratio: 0.85, level } });
    expect(codes(report)).toEqual([code]);
    expect(report.signals[0].level).toBe(level);
  });

  it("normal이나 null이면 신호가 없다", () => {
    expect(
      build({ jeonseRatio: { ratio: 0.5, level: "normal" }, debtRatio: null }).signals,
    ).toEqual([]);
    expect(
      build({ jeonseRatio: null, debtRatio: { ratio: 0.5, level: "normal" } }).signals,
    ).toEqual([]);
  });

  it("detail에 비율을 퍼센트로 채운다", () => {
    const report = build({ jeonseRatio: { ratio: 0.745, level: "caution" } });
    expect(report.signals[0].detail).toContain("74.5%");
  });
});

describe("buildRiskReport — HUG", () => {
  it("eligible === false면 hug-ineligible 신호", () => {
    const report = build({ hug: { eligible: false, reasons: ["exceeds-price-cap"] } });
    expect(codes(report)).toEqual(["hug-ineligible"]);
  });

  it("eligible === true면 신호가 없다", () => {
    expect(codes(build({ hug: { eligible: true, reasons: [] } }))).toEqual([]);
  });

  it("unknown이면 신호가 아니라 notes에 입력 부족 안내를 넣는다", () => {
    const hug = { eligible: "unknown", reasons: ["missing-official-price"] } as const;
    const report = build({ hug: { ...hug, reasons: [...hug.reasons] } });
    expect(codes(report)).toEqual([]);
    expect(report.notes).toContain(copy.hugUnknownNote(["missing-official-price"]));
    expect(report.notes).toHaveLength(2);
  });

  it("unknown이 아니면 HUG 안내는 notes에 없다", () => {
    expect(build().notes).toEqual([copy.reportingDelayNote(PRICE_ESTIMATE.reportingDelayDays)]);
  });
});

describe("buildRiskReport — 건물", () => {
  it.each(["공동주택", "아파트", "연립주택", "다세대주택"])("주용도 %s는 주거용이다", (purpose) => {
    expect(codes(build({ building: { ...normalBuilding, mainPurpose: purpose } }))).toEqual([]);
  });

  it("주거용이 아닌 주용도면 non-residential-use", () => {
    const report = build({ building: { ...normalBuilding, mainPurpose: "제2종근린생활시설" } });
    expect(codes(report)).toEqual(["non-residential-use"]);
    expect(report.signals[0].detail).toContain("제2종근린생활시설");
  });

  it("주용도가 null이면 신호가 없다", () => {
    expect(codes(build({ building: { ...normalBuilding, mainPurpose: null } }))).toEqual([]);
  });

  it("위반건축물이면 violation-building, false·null이면 없다", () => {
    expect(codes(build({ building: { ...normalBuilding, isViolation: true } }))).toEqual([
      "violation-building",
    ]);
    expect(codes(build({ building: { ...normalBuilding, isViolation: null } }))).toEqual([]);
  });

  it("사용승인일이 정확히 신축 기간 경계면 new-building", () => {
    const boundary = new Date(asOf);
    boundary.setUTCFullYear(asOf.getUTCFullYear() - RISK_SIGNAL.newBuildYears);
    expect(codes(build({ building: { ...normalBuilding, useApprovalDate: boundary } }))).toEqual([
      "new-building",
    ]);
  });

  it("신축 기간 경계보다 하루 이르면 신호가 없다", () => {
    const boundary = new Date(asOf);
    boundary.setUTCFullYear(asOf.getUTCFullYear() - RISK_SIGNAL.newBuildYears);
    const before = daysBefore(boundary, 1);
    expect(codes(build({ building: { ...normalBuilding, useApprovalDate: before } }))).toEqual([]);
  });

  it("사용승인일이 null이면 신호가 없다", () => {
    expect(codes(build({ building: { ...normalBuilding, useApprovalDate: null } }))).toEqual([]);
  });
});

describe("buildRiskReport — 권리(사용자 입력)", () => {
  it("신탁 등기면 trust-registered", () => {
    expect(codes(build({ rights: { ...normalRights, isTrust: true } }))).toEqual([
      "trust-registered",
    ]);
  });

  it("소유자 변동일이 정확히 변동 기간 경계면 recent-ownership-change", () => {
    const boundary = new Date(asOf);
    boundary.setUTCMonth(asOf.getUTCMonth() - RISK_SIGNAL.recentOwnerChangeMonths);
    const report = build({ rights: { ...normalRights, lastOwnershipChangeDate: boundary } });
    expect(codes(report)).toEqual(["recent-ownership-change"]);
  });

  it("소유자 변동 기간 경계보다 하루 이르면 신호가 없다", () => {
    const boundary = new Date(asOf);
    boundary.setUTCMonth(asOf.getUTCMonth() - RISK_SIGNAL.recentOwnerChangeMonths);
    const before = daysBefore(boundary, 1);
    expect(codes(build({ rights: { ...normalRights, lastOwnershipChangeDate: before } }))).toEqual(
      [],
    );
  });

  it("소유자 변동일이 null이면 신호가 없다", () => {
    expect(codes(build({ rights: { ...normalRights, lastOwnershipChangeDate: null } }))).toEqual(
      [],
    );
  });
});

describe("buildRiskReport — 시세 추정", () => {
  it("method가 none이면 price-unavailable", () => {
    const report = build({
      priceEstimate: estimate({ price: null, method: "none", confidence: "none" }),
      jeonseRatio: null,
      debtRatio: null,
    });
    expect(codes(report)).toEqual(["price-unavailable"]);
  });

  it("confidence가 low면 price-low-confidence", () => {
    const report = build({
      priceEstimate: estimate({ method: "official-price", confidence: "low" }),
    });
    expect(codes(report)).toEqual(["price-low-confidence"]);
  });

  it("confidence가 medium이면 신호가 없다", () => {
    const report = build({
      priceEstimate: estimate({ method: "dong-unit-price", confidence: "medium" }),
    });
    expect(codes(report)).toEqual([]);
  });
});

describe("금지 표현 검사", () => {
  it("신호가 켜진 보고서들이 모든 신호 코드를 한 번 이상 포함한다", () => {
    const all = new Set(allSignalReports().flatMap(codes));
    expect([...all].sort()).toEqual(Object.keys(copy.SIGNAL_COPY).sort());
  });

  it("신호가 켜진 보고서와 0개인 보고서의 모든 문구에 금지 표현이 없다", () => {
    for (const report of [...allSignalReports(), build()]) {
      for (const text of reportStrings(report)) expectNoForbidden(text);
    }
  });

  it("copy.ts가 export하는 모든 문자열 템플릿에 금지 표현이 없다", () => {
    const sampleDate = new Date("2026-08-01T00:00:00Z");
    const s = copy.SIGNAL_COPY;
    const rendered: string[] = [
      copy.headline(0),
      copy.headline(3),
      copy.DISCLAIMER,
      ...copy.SOURCES,
      copy.reportingDelayNote(PRICE_ESTIMATE.reportingDelayDays),
      copy.hugUnknownNote(["missing-official-price", "missing-region", "exceeds-deposit-limit"]),
      copy.hugUnknownNote(["missing-region", "exceeds-price-cap"]),
      s["jeonse-ratio-caution"].title,
      s["jeonse-ratio-caution"].detail(0.75),
      s["jeonse-ratio-danger"].title,
      s["jeonse-ratio-danger"].detail(0.9),
      s["debt-ratio-caution"].title,
      s["debt-ratio-caution"].detail({
        ratio: 0.75,
        maxClaimAmount: 0,
        seniorDeposits: 0,
        deposit,
      }),
      s["debt-ratio-danger"].title,
      s["debt-ratio-danger"].detail({
        ratio: 1.1,
        maxClaimAmount: 100_000_000,
        seniorDeposits: 20_000_000,
        deposit,
      }),
      s["hug-ineligible"].title,
      s["hug-ineligible"].detail(["exceeds-price-cap", "exceeds-deposit-limit"]),
      s["hug-ineligible"].detail([]),
      s["non-residential-use"].title,
      s["non-residential-use"].detail("제2종근린생활시설"),
      s["violation-building"].title,
      s["violation-building"].detail(),
      s["new-building"].title,
      s["new-building"].detail(sampleDate),
      s["trust-registered"].title,
      s["trust-registered"].detail(),
      s["recent-ownership-change"].title,
      s["recent-ownership-change"].detail(sampleDate),
      s["price-low-confidence"].title,
      s["price-low-confidence"].detail(),
      s["price-unavailable"].title,
      s["price-unavailable"].detail(),
    ];
    for (const text of rendered) {
      expect(text.length).toBeGreaterThan(0);
      expectNoForbidden(text);
    }
  });

  it("copy.ts의 export 목록이 위 검사 범위와 같다", () => {
    // 새 문구를 export하면 이 목록과 위 검사에 함께 추가한다.
    expect(Object.keys(copy).sort()).toEqual(
      [
        "DISCLAIMER",
        "SIGNAL_COPY",
        "SOURCES",
        "headline",
        "hugUnknownNote",
        "reportingDelayNote",
      ].sort(),
    );
  });

  it("disclaimer는 참고용·사용자 입력 의존·신고 지연·등기부와 전문가 확인을 담는다", () => {
    expect(copy.DISCLAIMER).toContain("참고용");
    expect(copy.DISCLAIMER).toContain("사용자가 입력");
    expect(copy.DISCLAIMER).toContain("신고 지연");
    expect(copy.DISCLAIMER).toContain("등기부등본");
    expect(copy.DISCLAIMER).toContain("전문가");
  });
});
