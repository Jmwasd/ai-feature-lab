import "server-only";

import { PRICE_ESTIMATE } from "@/consts/policy";

import { type BuildingRecord, type BuildingAddress, summarizeBuilding } from "../public-data/building";
import { PublicDataError } from "../public-data/http";
import type { NormalizedAddress } from "../public-data/juso";
import type { TradeHouseType } from "../public-data/molit-trade";
import type { FetchOfficialPriceParams, OfficialPrice } from "../public-data/official-price";
import { buildingKeyOf } from "../public-data/trade-keys";
import { type CollectDeps, ensureCollected } from "../trades/collect";
import { lookbackMonths } from "../trades/months";
import type { CollectionUnit, StoredTrade, TradeRepository } from "../trades/repository";

// 주소 하나에 대해 판정에 필요한 공공데이터(실거래·공시가격·건축물대장)를 모은다. 판정 계산은 하지 않는다.
// 출력 구조는 src/features/judgment/types.ts(ComparableTrade, BuildingInfo)에 맞추지만 import하지 않는다.
// server는 feature를 참조하지 않고, 둘을 잇는 조합은 routes가 한다(ARCHITECTURE).

const MANWON = 10_000;

const HOUSE_TYPE_LABEL: Record<TradeHouseType, "apartment" | "row-house"> = {
  APARTMENT: "apartment",
  ROW_HOUSE: "row-house",
};

export interface LookupTarget {
  address: NormalizedAddress; // juso 결과
  houseType: TradeHouseType;
  exclusiveArea: number; // ㎡
  dong: string | null;
  ho: string | null;
}

export interface PublicInputs {
  target: {
    buildingKey: string;
    lawdCd: string;
    umdName: string;
    houseType: "apartment" | "row-house";
    exclusiveArea: number;
  };
  // ComparableTrade와 구조가 같다. price는 원 단위다.
  saleTrades: Array<{
    buildingKey: string;
    lawdCd: string;
    umdName: string;
    houseType: "apartment" | "row-house";
    exclusiveArea: number;
    floor: number | null;
    contractDate: Date;
    price: number;
    cancelled: boolean;
    buildingName: string | null;
  }>;
  officialPrice: number | null; // 원
  officialPriceBaseYear: number | null;
  // BuildingInfo와 구조가 같다.
  building: { mainPurpose: string | null; isViolation: boolean | null; useApprovalDate: Date | null };
  dataBaseDate: Date; // 사용한 실거래 캐시의 가장 오래된 수집일(없으면 asOf)
  warnings: LookupWarning[]; // 부분 실패
}

export type LookupWarning =
  | { kind: "trades-partial"; failedMonths: string[] }
  | { kind: "trades-quota" }
  | { kind: "official-price-unavailable"; reason: "no-ho" | "not-found" | "error" }
  | { kind: "building-unavailable" };

export interface LookupDeps {
  repo: TradeRepository;
  fetchTrades: CollectDeps["fetchTrades"];
  fetchOfficialPrice: (params: FetchOfficialPriceParams) => Promise<OfficialPrice | null>;
  fetchBuildingRecords: (address: BuildingAddress) => Promise<BuildingRecord[]>;
  now: () => Date;
}

/** 실거래·공시가격·건축물대장에서 쓸 수 있는 데이터를 하나도 얻지 못했다. */
export class LookupFailedError extends Error {
  readonly warnings: LookupWarning[];

  constructor(warnings: LookupWarning[]) {
    super("실거래·공시가격·건축물대장을 모두 가져오지 못했다");
    this.name = "LookupFailedError";
    this.warnings = warnings;
  }
}

/**
 * 세 공공데이터를 병렬로 모은다. 부분 실패는 예외가 아니라 warnings로 돌려준다.
 * 누락 데이터는 null로 두고 0이나 기본값으로 채우지 않는다(위험을 가린다).
 * 세 곳 모두 쓸 수 있는 데이터가 없으면 LookupFailedError를 던진다.
 * PublicDataError가 아닌 예외(환경변수 누락, 버그)는 그대로 던진다.
 */
export async function collectPublicInputs(
  target: LookupTarget,
  deps: LookupDeps,
  asOf: Date,
): Promise<PublicInputs> {
  const [trades, official, building] = await Promise.all([
    collectTrades(target, deps, asOf),
    collectOfficialPrice(target, deps, asOf),
    collectBuilding(target, deps),
  ]);

  const warnings = [...trades.warnings, ...official.warnings, ...building.warnings];
  if (trades.failed && official.price === null && building.summary === null) {
    throw new LookupFailedError(warnings);
  }

  const { address, exclusiveArea } = target;
  return {
    target: {
      buildingKey: buildingKeyOf({
        lawdCd: address.lawdCd,
        umdName: address.umdName,
        jibun: address.jibun,
        buildingName: address.buildingName,
        isMountain: address.isMountain,
      }),
      lawdCd: address.lawdCd,
      umdName: address.umdName,
      houseType: HOUSE_TYPE_LABEL[target.houseType],
      exclusiveArea,
    },
    saleTrades: trades.saleTrades,
    officialPrice: official.price?.price ?? null,
    officialPriceBaseYear: official.price?.baseYear ?? null,
    building: building.summary ?? { mainPurpose: null, isViolation: null, useApprovalDate: null },
    dataBaseDate: trades.oldestCollectedAt ?? asOf,
    warnings,
  };
}

// 조회 기간의 매매 단위를 ensureCollected로 채운 뒤(ADR-004) 같은 법정동 전체를 조회한다.
// same-building 단계와 동 단위 단계가 모두 이 목록을 쓴다.
async function collectTrades(target: LookupTarget, deps: LookupDeps, asOf: Date) {
  const { lawdCd, umdName } = target.address;
  const months = lookbackMonths(asOf, PRICE_ESTIMATE.lookbackMonths);
  const units: CollectionUnit[] = months.map((dealYmd) => ({
    lawdCd,
    dealYmd,
    houseType: target.houseType,
    dealKind: "SALE",
  }));

  const ensured = await ensureCollected(units, {
    repo: deps.repo,
    fetchTrades: deps.fetchTrades,
    now: deps.now,
  });
  const stored = await deps.repo.findSaleTrades({
    lawdCd,
    houseType: target.houseType,
    fromYmd: months[0]!,
    toYmd: months[months.length - 1]!,
    umdName,
  });

  const warnings: LookupWarning[] = [];
  if (ensured.failed.some(({ error }) => error.kind === "quota")) warnings.push({ kind: "trades-quota" });
  if (ensured.failed.length > 0) {
    warnings.push({ kind: "trades-partial", failedMonths: ensured.failed.map(({ unit }) => unit.dealYmd) });
  }

  return {
    saleTrades: stored.flatMap(toSaleTrade),
    oldestCollectedAt: ensured.oldestCollectedAt,
    // 모든 단위가 실패했고 이전 수집분도 없으면 실거래는 쓸 데이터가 없다.
    failed: ensured.failed.length === units.length && ensured.oldestCollectedAt === null,
    warnings,
  };
}

// 매매가가 없는 행은 금액을 추정하지 않고 뺀다.
function toSaleTrade(trade: StoredTrade): PublicInputs["saleTrades"] {
  if (trade.priceManwon === null) return [];
  return [
    {
      buildingKey: trade.buildingKey,
      lawdCd: trade.lawdCd,
      umdName: trade.umdName,
      houseType: HOUSE_TYPE_LABEL[trade.houseType],
      exclusiveArea: trade.exclusiveArea,
      floor: trade.floor,
      contractDate: trade.contractDate,
      price: trade.priceManwon * MANWON,
      cancelled: trade.cancelled,
      buildingName: trade.buildingName,
    },
  ];
}

// 공시가격은 호 단위라 호를 모르면 호출하지 않는다. 다른 세대 값으로 대신하지 않는다.
async function collectOfficialPrice(
  target: LookupTarget,
  deps: LookupDeps,
  asOf: Date,
): Promise<{ price: OfficialPrice | null; warnings: LookupWarning[] }> {
  const ho = target.ho?.trim() ?? "";
  if (ho === "") {
    return { price: null, warnings: [{ kind: "official-price-unavailable", reason: "no-ho" }] };
  }
  try {
    const price = await deps.fetchOfficialPrice({ pnu: target.address.pnu, dong: target.dong, ho, asOf });
    if (price === null) {
      return { price: null, warnings: [{ kind: "official-price-unavailable", reason: "not-found" }] };
    }
    return { price, warnings: [] };
  } catch (error) {
    if (!(error instanceof PublicDataError)) throw error;
    return { price: null, warnings: [{ kind: "official-price-unavailable", reason: "error" }] };
  }
}

// 표제부가 없거나 조회에 실패하면 summary는 null이고 경고를 남긴다.
async function collectBuilding(
  target: LookupTarget,
  deps: LookupDeps,
): Promise<{ summary: PublicInputs["building"] | null; warnings: LookupWarning[] }> {
  const { admCd, isMountain, mainNo, subNo } = target.address;
  try {
    const records = await deps.fetchBuildingRecords({ admCd, isMountain, mainNo, subNo });
    if (records.length > 0) return { summary: summarizeBuilding(records, target.dong), warnings: [] };
  } catch (error) {
    if (!(error instanceof PublicDataError)) throw error;
  }
  return { summary: null, warnings: [{ kind: "building-unavailable" }] };
}
