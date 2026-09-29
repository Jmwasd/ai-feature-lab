import { describe, expect, it } from "vitest";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import { lookupWarningNote } from "./copy";
import { estimateSalePrice } from "./price-estimate";
import { checkHugEligibility, checkPriorityRepayment, debtRatio, jeonseRatio } from "./ratios";
import { isCapitalArea, priorityRegionTier } from "./region";
import { buildRiskReport } from "./risk-report";
import { runJudgment, type JudgmentInput } from "./run";
import type { ComparableTrade, JudgmentWarning } from "./types";

const asOf = new Date("2026-09-29T00:00:00Z");
const dataBaseDate = new Date("2026-09-01T00:00:00Z");
const SEOUL_ADM_CD = "1168010100"; // 서울 강남구 역삼동

const target = {
  buildingKey: "11680-역삼동-123",
  lawdCd: "11680",
  umdName: "역삼동",
  houseType: "row-house" as const,
  exclusiveArea: 59.9,
};

function trade(price: number, overrides: Partial<ComparableTrade> = {}): ComparableTrade {
  return {
    buildingKey: target.buildingKey,
    lawdCd: target.lawdCd,
    umdName: target.umdName,
    houseType: target.houseType,
    exclusiveArea: 59.9,
    floor: 3,
    contractDate: new Date("2026-05-10T00:00:00Z"),
    price,
    cancelled: false,
    buildingName: "역삼빌라",
    ...overrides,
  };
}

function baseInput(overrides: Partial<JudgmentInput> = {}): JudgmentInput {
  return {
    address: { display: "서울특별시 강남구 역삼동 123", admCd: SEOUL_ADM_CD, dong: "A", ho: "301" },
    deposit: 150_000_000,
    exclusiveArea: target.exclusiveArea,
    rights: {
      maxClaimAmount: 0,
      seniorDeposits: 0,
      isTrust: false,
      lastOwnershipChangeDate: new Date("2018-03-01T00:00:00Z"),
    },
    publicData: {
      target,
      saleTrades: [trade(300_000_000), trade(310_000_000)],
      officialPrice: 250_000_000,
      building: {
        mainPurpose: "공동주택",
        isViolation: false,
        useApprovalDate: new Date("2010-05-01T00:00:00Z"),
      },
      dataBaseDate,
      warnings: [],
    },
    asOf,
    ...overrides,
  };
}

// 개별 판정 함수를 직접 호출해 기대값을 만든다. runJudgment와 결과가 달라지면 조립이 규칙을 바꾼 것이다.
function expectedFor(input: JudgmentInput) {
  const { deposit, rights, publicData, address } = input;
  const priceEstimate = estimateSalePrice({
    target: publicData.target,
    saleTrades: publicData.saleTrades,
    officialPrice: publicData.officialPrice ?? undefined,
    asOf: input.asOf,
  });
  const jr = jeonseRatio(deposit, priceEstimate.price);
  const dr = debtRatio({
    deposit,
    maxClaimAmount: rights.maxClaimAmount,
    seniorDeposits: rights.seniorDeposits,
    estimatedPrice: priceEstimate.price,
  });
  const hug = checkHugEligibility({
    deposit,
    seniorDebt: rights.maxClaimAmount + rights.seniorDeposits,
    officialPrice: publicData.officialPrice,
    isCapitalArea: isCapitalArea(address.admCd),
  });
  const priorityRepayment = checkPriorityRepayment({
    deposit,
    regionTier: priorityRegionTier(address.admCd),
  });
  const report = buildRiskReport({
    deposit,
    priceEstimate,
    jeonseRatio: jr,
    debtRatio: dr,
    hug,
    building: publicData.building,
    rights,
    asOf: input.asOf,
    dataBaseDate: publicData.dataBaseDate,
  });
  return { priceEstimate, jr, dr, hug, priorityRepayment, report };
}

function expectMatchesDirectCalls(input: JudgmentInput) {
  const result = runJudgment(input);
  const e = expectedFor(input);
  expect(result.priceEstimate).toEqual(e.priceEstimate);
  expect(result.jeonseRatio).toEqual(e.jr);
  expect(result.debtRatio).toEqual(e.dr);
  expect(result.hug).toEqual(e.hug);
  expect(result.priorityRepayment).toEqual(e.priorityRepayment);
  expect(result.report).toEqual({
    ...e.report,
    notes: [...e.report.notes, ...input.publicData.warnings.map(lookupWarningNote)],
  });
  return result;
}

const ALL_WARNINGS: JudgmentWarning[] = [
  { kind: "trades-partial", failedMonths: ["202604", "202605"] },
  { kind: "trades-quota" },
  { kind: "official-price-unavailable", reason: "no-ho" },
  { kind: "official-price-unavailable", reason: "not-found" },
  { kind: "official-price-unavailable", reason: "error" },
  { kind: "building-unavailable" },
];

describe("runJudgment", () => {
  it("신호 없음: 개별 함수 결과와 같고 위험 신호 0개다", () => {
    const input = baseInput();
    const result = expectMatchesDirectCalls(input);
    expect(result.report.signalCount).toBe(0);
    expect(result.report.headline).toBe("위험 신호 0개");
    expect(result.hug.eligible).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("깡통전세: 전세가율·부채비율 위험 신호가 개별 함수 결과와 같다", () => {
    const input = baseInput({
      deposit: 280_000_000,
      rights: {
        maxClaimAmount: 120_000_000,
        seniorDeposits: 30_000_000,
        isTrust: false,
        lastOwnershipChangeDate: null,
      },
    });
    const result = expectMatchesDirectCalls(input);
    expect(result.jeonseRatio?.level).toBe("danger");
    expect(result.debtRatio?.level).toBe("danger");
    expect(result.hug.eligible).toBe(false);
    const codes = result.report.signals.map((s) => s.code);
    expect(codes).toContain("jeonse-ratio-danger");
    expect(codes).toContain("debt-ratio-danger");
    expect(codes).toContain("hug-ineligible");
  });

  it("입력 부족: 시세·공시가격·건축물대장이 없으면 비율은 null, HUG는 unknown이다", () => {
    const input = baseInput({
      address: { display: "서울특별시 강남구 역삼동 123", admCd: SEOUL_ADM_CD },
      publicData: {
        target,
        saleTrades: [],
        officialPrice: null,
        building: { mainPurpose: null, isViolation: null, useApprovalDate: null },
        dataBaseDate,
        warnings: [
          { kind: "official-price-unavailable", reason: "no-ho" },
          { kind: "building-unavailable" },
        ],
      },
    });
    const result = expectMatchesDirectCalls(input);
    expect(result.priceEstimate.method).toBe("none");
    expect(result.jeonseRatio).toBeNull();
    expect(result.debtRatio).toBeNull();
    expect(result.hug.eligible).toBe("unknown");
    expect(result.report.signals.map((s) => s.code)).toContain("price-unavailable");
  });

  it("debtRatio와 HUG seniorDebt가 같은 rights에서 나온다", () => {
    const rights = {
      maxClaimAmount: 90_000_000,
      seniorDeposits: 40_000_000,
      isTrust: false,
      lastOwnershipChangeDate: null,
    };
    const input = baseInput({ deposit: 200_000_000, rights });
    const result = expectMatchesDirectCalls(input);
    const estimated = result.priceEstimate.price!;
    expect(result.debtRatio?.ratio).toBeCloseTo((90_000_000 + 40_000_000 + 200_000_000) / estimated);
    // 250,000,000 × 126% = 315,000,000 < 200,000,000 + 130,000,000
    expect(result.hug.reasons).toContain("exceeds-price-cap");
  });

  it("지역 구간을 판별하지 못하면 최우선변제는 null, HUG는 unknown이다", () => {
    const input = baseInput({
      address: { display: "알 수 없는 지역", admCd: "0000000000", ho: "301" },
    });
    const result = expectMatchesDirectCalls(input);
    expect(result.priorityRepayment).toBeNull();
    expect(result.hug.eligible).toBe("unknown");
    expect(result.hug.reasons).toContain("missing-region");
  });

  it("공공데이터 경고를 순서대로 notes 뒤에 붙이고 warnings로 그대로 돌려준다", () => {
    const input = baseInput({
      publicData: { ...baseInput().publicData, warnings: ALL_WARNINGS },
    });
    const result = expectMatchesDirectCalls(input);
    const notes = result.report.notes;
    expect(notes.slice(-ALL_WARNINGS.length)).toEqual(ALL_WARNINGS.map(lookupWarningNote));
    expect(result.warnings).toEqual(ALL_WARNINGS);
  });

  it("주소·보증금·면적·권리 입력을 뷰에 그대로 담는다", () => {
    const input = baseInput();
    const result = runJudgment(input);
    expect(result.address).toEqual({ display: input.address.display, dong: "A", ho: "301" });
    expect(result.deposit).toBe(input.deposit);
    expect(result.exclusiveArea).toBe(input.exclusiveArea);
    expect(result.rights).toBe(input.rights);
    expect(result.report.dataBaseDate).toBe(dataBaseDate);
  });

  it("결과 문구와 경고 문구에 금지 표현이 없다", () => {
    const input = baseInput({
      deposit: 280_000_000,
      publicData: { ...baseInput().publicData, warnings: ALL_WARNINGS },
    });
    const result = runJudgment(input);
    const texts = [
      result.report.headline,
      result.report.disclaimer,
      ...result.report.notes,
      ...result.report.signals.flatMap((s) => [s.title, s.detail]),
    ];
    for (const text of texts) expectNoForbiddenPhrases(text);
  });
});

describe("lookupWarningNote", () => {
  it("경고 종류마다 서로 다른 비어 있지 않은 문구를 낸다", () => {
    const notes = ALL_WARNINGS.map(lookupWarningNote);
    for (const note of notes) expect(note.length).toBeGreaterThan(0);
    expect(new Set(notes).size).toBe(notes.length);
  });

  it("누락 월을 문구에 적는다", () => {
    const note = lookupWarningNote({ kind: "trades-partial", failedMonths: ["202604", "202605"] });
    expect(note).toContain("2026-04");
    expect(note).toContain("2026-05");
  });
});
