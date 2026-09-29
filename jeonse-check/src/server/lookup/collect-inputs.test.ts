import { beforeEach, describe, expect, it } from "vitest";

import { PRICE_ESTIMATE } from "@/consts/policy";

import { PublicDataError } from "../public-data/http";
import type { NormalizedAddress } from "../public-data/juso";
import type { FetchTradesParams, RawTrade } from "../public-data/molit-trade";
import type { FetchOfficialPriceParams, OfficialPrice } from "../public-data/official-price";
import type { BuildingAddress, BuildingRecord } from "../public-data/building";
import { buildingKeyOf, dedupKeyOf } from "../public-data/trade-keys";
import { createMemoryTradeRepository } from "../trades/memory-repository";
import { lookbackMonths } from "../trades/months";
import type { CollectionUnit, TradeRepository } from "../trades/repository";
import {
  collectPublicInputs,
  type LookupDeps,
  LookupFailedError,
  type LookupTarget,
} from "./collect-inputs";

const asOf = new Date(Date.UTC(2024, 9, 15, 3)); // 2024-10-15
const now = new Date(Date.UTC(2024, 9, 15, 3));
const months = lookbackMonths(asOf, PRICE_ESTIMATE.lookbackMonths);

const address: NormalizedAddress = {
  id: "1144012300104120007000001",
  roadAddress: "서울특별시 마포구 망원로 1",
  jibunAddress: "서울특별시 마포구 망원동 412-7",
  buildingName: "망원하이빌",
  admCd: "1144012300",
  lawdCd: "11440",
  sidoName: "서울특별시",
  sigunguName: "마포구",
  umdName: "망원동",
  isMountain: false,
  mainNo: 412,
  subNo: 7,
  jibun: "412-7",
  pnu: "1144012300104120007",
};

const target: LookupTarget = {
  address,
  houseType: "ROW_HOUSE",
  exclusiveArea: 59.9,
  dong: null,
  ho: "301",
};

function saleTrade(dealYmd: string, overrides: Partial<RawTrade> = {}): RawTrade {
  const fields = {
    houseType: "ROW_HOUSE" as const,
    dealKind: "SALE" as const,
    lawdCd: "11440",
    dealYmd,
    umdName: "망원동",
    jibun: "412-7",
    buildingName: "망원하이빌",
    exclusiveArea: 59.9,
    floor: 3,
    contractDate: new Date(Date.UTC(Number(dealYmd.slice(0, 4)), Number(dealYmd.slice(4, 6)) - 1, 10)),
    priceManwon: 45000,
    depositManwon: null,
    monthlyRentManwon: null,
    cancelled: false,
    cancelledDate: null,
    ...overrides,
  };
  return { ...fields, buildingKey: buildingKeyOf(fields), dedupKey: dedupKeyOf(fields) };
}

const unitOf = (dealYmd: string): CollectionUnit => ({
  lawdCd: "11440",
  dealYmd,
  houseType: "ROW_HOUSE",
  dealKind: "SALE",
});

const officialPrice: OfficialPrice = {
  price: 210_000_000,
  baseYear: 2024,
  dongName: null,
  hoName: "301",
  exclusiveArea: 59.9,
};

const buildingRecord: BuildingRecord = {
  mainPurpose: "공동주택",
  isViolation: null,
  useApprovalDate: new Date(Date.UTC(2015, 4, 20)),
  dongName: null,
};

const apiError = (source: "molit-trade" | "vworld" | "building" = "molit-trade") =>
  new PublicDataError("api", source, "99 오류");

// 호출을 기록하는 가짜 어댑터 묶음. 응답은 테스트마다 바꾼다.
function fakes(repo: TradeRepository) {
  const calls = {
    trades: [] as FetchTradesParams[],
    officialPrice: [] as FetchOfficialPriceParams[],
    building: [] as BuildingAddress[],
  };
  const responses = {
    trades: {} as Record<string, RawTrade[] | Error>,
    officialPrice: officialPrice as OfficialPrice | null | Error,
    building: [buildingRecord] as BuildingRecord[] | Error,
  };
  const deps: LookupDeps = {
    repo,
    now: () => now,
    fetchTrades: async (params) => {
      calls.trades.push(params);
      const response = responses.trades[params.dealYmd] ?? [];
      if (response instanceof Error) throw response;
      return response;
    },
    fetchOfficialPrice: async (params) => {
      calls.officialPrice.push(params);
      if (responses.officialPrice instanceof Error) throw responses.officialPrice;
      return responses.officialPrice;
    },
    fetchBuildingRecords: async (buildingAddress) => {
      calls.building.push(buildingAddress);
      if (responses.building instanceof Error) throw responses.building;
      return responses.building;
    },
  };
  return { deps, calls, responses };
}

describe("collectPublicInputs", () => {
  let repo: TradeRepository;

  beforeEach(() => {
    repo = createMemoryTradeRepository();
  });

  it("캐시 미스면 조회 기간의 매매 단위를 수집한 뒤 같은 법정동 거래를 돌려준다", async () => {
    const { deps, calls, responses } = fakes(repo);
    responses.trades[months[0]!] = [saleTrade(months[0]!)];
    responses.trades[months[5]!] = [
      saleTrade(months[5]!, { jibun: "100", buildingName: "다른빌라", priceManwon: 30000 }),
      saleTrade(months[5]!, { umdName: "합정동", priceManwon: 50000 }),
    ];

    const result = await collectPublicInputs(target, deps, asOf);

    expect(calls.trades.map((c) => c.dealYmd)).toEqual(months);
    expect(calls.trades.every((c) => c.dealKind === "SALE" && c.houseType === "ROW_HOUSE")).toBe(true);
    expect(calls.trades.every((c) => c.lawdCd === "11440")).toBe(true);
    // 다른 법정동(합정동)은 빠지고, 같은 동의 다른 건물은 동 단계 추정용으로 남는다.
    expect(result.saleTrades.map((t) => t.price)).toEqual([450_000_000, 300_000_000]);
    expect(result.warnings).toEqual([]);
  });

  it("대상 buildingKey는 juso 주소로 만들어 실거래 buildingKey와 맞는다", async () => {
    const { deps, responses } = fakes(repo);
    responses.trades[months[0]!] = [saleTrade(months[0]!)];

    const result = await collectPublicInputs(target, deps, asOf);

    expect(result.target).toEqual({
      buildingKey: "11440|망원동|412-7",
      lawdCd: "11440",
      umdName: "망원동",
      houseType: "row-house",
      exclusiveArea: 59.9,
    });
    expect(result.saleTrades[0]!.buildingKey).toBe(result.target.buildingKey);
  });

  it("캐시가 신선하면 실거래 API를 호출하지 않는다", async () => {
    const { deps, calls } = fakes(repo);
    await repo.upsertTrades([saleTrade(months[3]!)]);
    for (const ymd of months) await repo.recordCollection(unitOf(ymd), 1, now);

    const result = await collectPublicInputs(target, deps, asOf);

    expect(calls.trades).toEqual([]);
    expect(result.saleTrades).toHaveLength(1);
  });

  it("만원을 원으로 바꾸고 유형을 소문자로 바꾸며 해제 거래도 표시해 남긴다", async () => {
    const { deps, responses } = fakes(repo);
    responses.trades[months[2]!] = [
      saleTrade(months[2]!, { priceManwon: 45123, floor: null, cancelled: true }),
    ];

    const result = await collectPublicInputs(target, deps, asOf);

    expect(result.saleTrades).toEqual([
      {
        buildingKey: "11440|망원동|412-7",
        lawdCd: "11440",
        umdName: "망원동",
        houseType: "row-house",
        exclusiveArea: 59.9,
        floor: null,
        contractDate: new Date(Date.UTC(Number(months[2]!.slice(0, 4)), Number(months[2]!.slice(4, 6)) - 1, 10)),
        price: 451_230_000,
        cancelled: true,
        buildingName: "망원하이빌",
      },
    ]);
  });

  it("아파트는 apartment로 바꾼다", async () => {
    const { deps, calls } = fakes(repo);
    const result = await collectPublicInputs({ ...target, houseType: "APARTMENT" }, deps, asOf);

    expect(calls.trades.every((c) => c.houseType === "APARTMENT")).toBe(true);
    expect(result.target.houseType).toBe("apartment");
  });

  it("공시가격은 pnu·동·호·asOf로 조회한다", async () => {
    const { deps, calls } = fakes(repo);
    const result = await collectPublicInputs({ ...target, dong: "101" }, deps, asOf);

    expect(calls.officialPrice).toEqual([{ pnu: address.pnu, dong: "101", ho: "301", asOf }]);
    expect(result.officialPrice).toBe(210_000_000);
    expect(result.officialPriceBaseYear).toBe(2024);
  });

  it.each([null, "  "])("호가 없으면(%j) 공시가격을 호출하지 않고 경고한다", async (ho) => {
    const { deps, calls } = fakes(repo);
    const result = await collectPublicInputs({ ...target, ho }, deps, asOf);

    expect(calls.officialPrice).toEqual([]);
    expect(result.officialPrice).toBeNull();
    expect(result.officialPriceBaseYear).toBeNull();
    expect(result.warnings).toEqual([{ kind: "official-price-unavailable", reason: "no-ho" }]);
  });

  it("공시가격 세대를 찾지 못하면 not-found 경고", async () => {
    const { deps, responses } = fakes(repo);
    responses.officialPrice = null;

    const result = await collectPublicInputs(target, deps, asOf);

    expect(result.officialPrice).toBeNull();
    expect(result.warnings).toEqual([{ kind: "official-price-unavailable", reason: "not-found" }]);
  });

  it("공시가격 API가 실패하면 error 경고", async () => {
    const { deps, responses } = fakes(repo);
    responses.officialPrice = apiError("vworld");

    const result = await collectPublicInputs(target, deps, asOf);

    expect(result.officialPrice).toBeNull();
    expect(result.warnings).toEqual([{ kind: "official-price-unavailable", reason: "error" }]);
  });

  it("건축물대장은 주소 필지로 조회하고 동으로 요약한다", async () => {
    const { deps, calls, responses } = fakes(repo);
    responses.building = [
      { ...buildingRecord, dongName: "101동", mainPurpose: "공동주택" },
      { ...buildingRecord, dongName: "102동", mainPurpose: "제2종근린생활시설" },
    ];

    const result = await collectPublicInputs({ ...target, dong: "102" }, deps, asOf);

    expect(calls.building).toEqual([{ admCd: "1144012300", isMountain: false, mainNo: 412, subNo: 7 }]);
    expect(result.building).toEqual({
      mainPurpose: "제2종근린생활시설",
      isViolation: null,
      useApprovalDate: buildingRecord.useApprovalDate,
    });
  });

  it("건축물대장이 실패하면 모든 필드 null과 경고", async () => {
    const { deps, responses } = fakes(repo);
    responses.building = apiError("building");

    const result = await collectPublicInputs(target, deps, asOf);

    expect(result.building).toEqual({ mainPurpose: null, isViolation: null, useApprovalDate: null });
    expect(result.warnings).toEqual([{ kind: "building-unavailable" }]);
  });

  it("건축물대장 결과가 없어도 경고한다", async () => {
    const { deps, responses } = fakes(repo);
    responses.building = [];

    const result = await collectPublicInputs(target, deps, asOf);

    expect(result.building).toEqual({ mainPurpose: null, isViolation: null, useApprovalDate: null });
    expect(result.warnings).toEqual([{ kind: "building-unavailable" }]);
  });

  it("일부 월이 실패하면 실패한 월을 경고로 돌려준다", async () => {
    const { deps, responses } = fakes(repo);
    responses.trades[months[1]!] = apiError();
    responses.trades[months[4]!] = apiError();
    responses.trades[months[0]!] = [saleTrade(months[0]!)];

    const result = await collectPublicInputs(target, deps, asOf);

    expect(result.saleTrades).toHaveLength(1);
    expect(result.warnings).toEqual([{ kind: "trades-partial", failedMonths: [months[1], months[4]] }]);
  });

  it("호출 한도에 걸리면 한도 경고와 실패한 월을 함께 돌려준다", async () => {
    const { deps, responses } = fakes(repo);
    // 앞의 월은 캐시에 있어 호출하지 않고, 첫 호출에서 한도가 나면 남은 월은 모두 실패한다.
    for (const ymd of months.slice(0, 6)) await repo.recordCollection(unitOf(ymd), 0, now);
    await repo.upsertTrades([saleTrade(months[0]!)]);
    for (const ymd of months.slice(6)) {
      responses.trades[ymd] = new PublicDataError("quota", "molit-trade", "호출 한도 초과");
    }

    const result = await collectPublicInputs(target, deps, asOf);

    expect(result.saleTrades).toHaveLength(1);
    expect(result.warnings).toEqual([
      { kind: "trades-quota" },
      { kind: "trades-partial", failedMonths: months.slice(6) },
    ]);
  });

  it("dataBaseDate는 사용한 실거래 캐시의 가장 오래된 수집일이다", async () => {
    const { deps } = fakes(repo);
    const oldest = new Date(now.getTime() - 60 * 60 * 1000); // 1시간 전: 모든 월이 아직 신선하다
    for (const ymd of months) await repo.recordCollection(unitOf(ymd), 0, now);
    await repo.recordCollection(unitOf(months[3]!), 0, oldest);

    const result = await collectPublicInputs(target, deps, asOf);

    expect(result.dataBaseDate).toEqual(oldest);
  });

  it("사용한 실거래 캐시가 없으면 dataBaseDate는 asOf다", async () => {
    const { deps, responses } = fakes(repo);
    for (const ymd of months) responses.trades[ymd] = apiError();

    const result = await collectPublicInputs(target, deps, asOf);

    expect(result.dataBaseDate).toEqual(asOf);
    expect(result.saleTrades).toEqual([]);
    expect(result.warnings).toEqual([{ kind: "trades-partial", failedMonths: months }]);
  });

  it("실거래·공시가격·건축물대장이 모두 실패하면 LookupFailedError를 던진다", async () => {
    const { deps, responses } = fakes(repo);
    for (const ymd of months) responses.trades[ymd] = apiError();
    responses.officialPrice = apiError("vworld");
    responses.building = apiError("building");

    await expect(collectPublicInputs(target, deps, asOf)).rejects.toBeInstanceOf(LookupFailedError);
  });

  it("실거래만 성공해도 예외 없이 경고로 돌려준다", async () => {
    const { deps, responses } = fakes(repo);
    responses.officialPrice = apiError("vworld");
    responses.building = apiError("building");

    const result = await collectPublicInputs(target, deps, asOf);

    expect(result.warnings).toEqual([
      { kind: "official-price-unavailable", reason: "error" },
      { kind: "building-unavailable" },
    ]);
  });

  it("공공데이터 오류가 아닌 예외는 그대로 던진다", async () => {
    const { deps, responses } = fakes(repo);
    responses.building = new TypeError("버그");

    await expect(collectPublicInputs(target, deps, asOf)).rejects.toBeInstanceOf(TypeError);
  });

  it("실거래·공시가격·건축물대장을 병렬로 호출한다", async () => {
    const { deps } = fakes(repo);
    const started: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const waitAll = async <T>(name: string, value: T): Promise<T> => {
      started.push(name);
      if (started.length === 3) release();
      await gate;
      return value;
    };
    // 하나라도 다른 호출이 끝나길 기다리면 gate가 열리지 않아 시간 초과로 실패한다.
    const parallelDeps: LookupDeps = {
      ...deps,
      fetchTrades: async (params) => (params.dealYmd === months[0] ? waitAll("trades", []) : []),
      fetchOfficialPrice: async () => waitAll("officialPrice", officialPrice),
      fetchBuildingRecords: async () => waitAll("building", [buildingRecord]),
    };

    await collectPublicInputs(target, { ...parallelDeps }, asOf);

    expect([...started].sort()).toEqual(["building", "officialPrice", "trades"]);
  });
});
