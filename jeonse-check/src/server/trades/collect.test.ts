import { beforeEach, describe, expect, it } from "vitest";

import { COLLECTION, PRICE_ESTIMATE } from "@/consts/policy";

import { PublicDataError } from "../public-data/http";
import type { FetchTradesParams, RawTrade } from "../public-data/molit-trade";
import { buildingKeyOf, dedupKeyOf } from "../public-data/trade-keys";
import { collectUnit, type CollectDeps, ensureCollected, needsRefresh } from "./collect";
import { createMemoryTradeRepository } from "./memory-repository";
import type { CollectionUnit, TradeRepository } from "./repository";

const DAY_MS = 24 * 60 * 60 * 1000;

const unit: CollectionUnit = { lawdCd: "11440", dealYmd: "202408", houseType: "ROW_HOUSE", dealKind: "SALE" };

function unitOf(dealYmd: string, lawdCd = "11440"): CollectionUnit {
  return { ...unit, lawdCd, dealYmd };
}

function tradeFor(target: CollectionUnit, day: number, overrides: Partial<RawTrade> = {}): RawTrade {
  const year = Number(target.dealYmd.slice(0, 4));
  const month = Number(target.dealYmd.slice(4, 6)) - 1;
  const fields = {
    houseType: target.houseType,
    dealKind: target.dealKind,
    lawdCd: target.lawdCd,
    dealYmd: target.dealYmd,
    umdName: "망원동",
    jibun: "412-7",
    buildingName: "망원하이빌",
    exclusiveArea: 59.9,
    floor: 3,
    contractDate: new Date(Date.UTC(year, month, day)),
    priceManwon: 45000,
    depositManwon: null,
    monthlyRentManwon: null,
    cancelled: false,
    cancelledDate: null,
    ...overrides,
  };
  return { ...fields, buildingKey: buildingKeyOf(fields), dedupKey: dedupKeyOf(fields) };
}

// 단위 키 → 응답(거래 배열 또는 던질 오류). 호출된 단위를 calls에 남긴다.
type Responder = RawTrade[] | Error;
function fakeFetchTrades(responses: Record<string, Responder> = {}) {
  const calls: FetchTradesParams[] = [];
  const fn = async (params: FetchTradesParams): Promise<RawTrade[]> => {
    calls.push(params);
    const response = responses[`${params.lawdCd}|${params.dealYmd}`] ?? [];
    if (response instanceof Error) throw response;
    return response;
  };
  return Object.assign(fn, { calls });
}

// 계약월 신고 기간이 끝나는 시각: 다음 달 1일 0시(UTC) + 신고 지연 일수
function reportingClosesAt(dealYmd: string): Date {
  const year = Number(dealYmd.slice(0, 4));
  const month = Number(dealYmd.slice(4, 6));
  return new Date(Date.UTC(year, month, 1) + PRICE_ESTIMATE.reportingDelayDays * DAY_MS);
}

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
const addMs = (date: Date, ms: number) => new Date(date.getTime() + ms);

const quota = () => new PublicDataError("quota", "molit-trade", "호출 한도 초과");
const apiError = () => new PublicDataError("api", "molit-trade", "99 오류");

describe("collectUnit", () => {
  let repo: TradeRepository;
  const now = new Date(Date.UTC(2024, 9, 1, 3));

  beforeEach(() => {
    repo = createMemoryTradeRepository();
  });

  function deps(fetchTrades: ReturnType<typeof fakeFetchTrades>): CollectDeps {
    return { repo, fetchTrades, now: () => now };
  }

  it("받은 거래를 저장하고 수집 로그를 남긴다", async () => {
    const trades = [tradeFor(unit, 3), tradeFor(unit, 12)];
    const fetch = fakeFetchTrades({ "11440|202408": trades });

    const result = await collectUnit(unit, deps(fetch));

    expect(result).toEqual({ fetched: 2, inserted: 2, updated: 0 });
    expect(fetch.calls).toEqual([unit]);
    const stored = await repo.findSaleTrades({
      lawdCd: "11440",
      houseType: "ROW_HOUSE",
      fromYmd: "202408",
      toYmd: "202408",
    });
    expect(stored).toHaveLength(2);
    expect(await repo.getCollection(unit)).toEqual({ collectedAt: now, itemCount: 2 });
  });

  it("결과 0건도 itemCount 0으로 로그를 남긴다", async () => {
    const result = await collectUnit(unit, deps(fakeFetchTrades()));

    expect(result).toEqual({ fetched: 0, inserted: 0, updated: 0 });
    expect(await repo.getCollection(unit)).toEqual({ collectedAt: now, itemCount: 0 });
  });

  it("API가 실패하면 저장도 로그도 하지 않고 오류를 던진다", async () => {
    const fetch = fakeFetchTrades({ "11440|202408": apiError() });

    await expect(collectUnit(unit, deps(fetch))).rejects.toBeInstanceOf(PublicDataError);
    expect(await repo.getCollection(unit)).toBeNull();
  });

  it("같은 단위를 다시 수집해도 중복이 생기지 않는다", async () => {
    const fetch = fakeFetchTrades({ "11440|202408": [tradeFor(unit, 3), tradeFor(unit, 12)] });

    await collectUnit(unit, deps(fetch));
    const again = await collectUnit(unit, deps(fetch));

    expect(again).toEqual({ fetched: 2, inserted: 0, updated: 2 });
    const stored = await repo.findSaleTrades({
      lawdCd: "11440",
      houseType: "ROW_HOUSE",
      fromYmd: "202408",
      toYmd: "202408",
    });
    expect(stored).toHaveLength(2);
  });
});

describe("needsRefresh", () => {
  const closes = reportingClosesAt(unit.dealYmd);

  it("수집 로그가 없으면 받는다", () => {
    expect(needsRefresh(unit, null, new Date(Date.UTC(2024, 7, 15)))).toBe(true);
    expect(needsRefresh(unit, null, addDays(closes, 365))).toBe(true);
  });

  describe("최근 월(신고 기간이 끝나지 않음)", () => {
    const now = addMs(closes, -1);
    const refreshMs = COLLECTION.recentRefreshDays * DAY_MS;

    it(`수집 후 ${COLLECTION.recentRefreshDays}일이 안 지났으면 받지 않는다`, () => {
      const collectedAt = addMs(now, -(refreshMs - 1));
      expect(needsRefresh(unit, { collectedAt }, now)).toBe(false);
    });

    it(`수집 후 ${COLLECTION.recentRefreshDays}일이 지났으면 다시 받는다`, () => {
      const collectedAt = addMs(now, -refreshMs);
      expect(needsRefresh(unit, { collectedAt }, now)).toBe(true);
    });

    it("계약월이 진행 중인 달도 최근 월이다", () => {
      const midMonth = new Date(Date.UTC(2024, 7, 20));
      expect(needsRefresh(unit, { collectedAt: addMs(midMonth, -refreshMs + 1) }, midMonth)).toBe(false);
      expect(needsRefresh(unit, { collectedAt: addMs(midMonth, -refreshMs) }, midMonth)).toBe(true);
    });
  });

  describe("과거 월(신고 기간이 끝남)", () => {
    const refreshMs = COLLECTION.pastRefreshDays * DAY_MS;

    it(`신고 기간이 끝난 뒤 수집했으면 ${COLLECTION.pastRefreshDays}일 동안 받지 않는다`, () => {
      const collectedAt = closes;
      expect(needsRefresh(unit, { collectedAt }, addMs(collectedAt, refreshMs - 1))).toBe(false);
    });

    it(`수집 후 ${COLLECTION.pastRefreshDays}일이 지나면 해제 반영을 위해 다시 받는다`, () => {
      const collectedAt = closes;
      expect(needsRefresh(unit, { collectedAt }, addMs(collectedAt, refreshMs))).toBe(true);
    });

    it("신고 기간 중에 수집한 뒤 기간이 끝났으면 늦게 들어온 신고를 위해 다시 받는다", () => {
      const collectedAt = addMs(closes, -1);
      expect(needsRefresh(unit, { collectedAt }, closes)).toBe(true);
    });
  });
});

describe("ensureCollected", () => {
  let repo: TradeRepository;
  const now = new Date(Date.UTC(2024, 9, 1, 3));

  beforeEach(() => {
    repo = createMemoryTradeRepository();
  });

  it("needsRefresh가 참인 단위만 받는다", async () => {
    const fresh = unitOf("202401");
    const stale = unitOf("202402");
    const missing = unitOf("202403");
    const freshAt = addDays(now, -1);
    const staleAt = addDays(now, -COLLECTION.pastRefreshDays);
    await repo.recordCollection(fresh, 5, freshAt);
    await repo.recordCollection(stale, 5, staleAt);
    const fetch = fakeFetchTrades();

    const result = await ensureCollected([fresh, stale, missing], { repo, fetchTrades: fetch, now: () => now });

    expect(fetch.calls).toEqual([stale, missing]);
    expect(result.refreshed).toEqual([stale, missing]);
    expect(result.skipped).toEqual([fresh]);
    expect(result.failed).toEqual([]);
    expect(await repo.getCollection(stale)).toEqual({ collectedAt: now, itemCount: 0 });
  });

  it("한 단위가 실패해도 나머지는 계속하고 failed에 모은다", async () => {
    const [a, b, c] = [unitOf("202401"), unitOf("202402"), unitOf("202403")];
    const error = apiError();
    const fetch = fakeFetchTrades({ "11440|202402": error, "11440|202403": [tradeFor(c, 5)] });

    const result = await ensureCollected([a, b, c], { repo, fetchTrades: fetch, now: () => now });

    expect(result.refreshed).toEqual([a, c]);
    expect(result.failed).toEqual([{ unit: b, error }]);
    expect(await repo.getCollection(b)).toBeNull();
    expect(await repo.getCollection(c)).toEqual({ collectedAt: now, itemCount: 1 });
  });

  it("quota 오류가 나면 남은 단위를 호출하지 않고 모두 failed로 넣는다", async () => {
    const units = ["202401", "202402", "202403", "202404"].map((ym) => unitOf(ym));
    const error = quota();
    const fetch = fakeFetchTrades({ "11440|202402": error });

    const result = await ensureCollected(units, { repo, fetchTrades: fetch, now: () => now, concurrency: 1 });

    expect(fetch.calls).toEqual([units[0], units[1]]);
    expect(result.refreshed).toEqual([units[0]]);
    expect(result.failed).toEqual([
      { unit: units[1], error },
      { unit: units[2], error },
      { unit: units[3], error },
    ]);
    expect(await repo.getCollection(units[2]!)).toBeNull();
  });

  it("동시 호출 수가 concurrency를 넘지 않고 기본값은 2다", async () => {
    let active = 0;
    let peak = 0;
    const fetch = async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return [];
    };
    const units = ["202401", "202402", "202403", "202404", "202405"].map((ym) => unitOf(ym));

    const result = await ensureCollected(units, { repo, fetchTrades: fetch, now: () => now });

    expect(peak).toBe(2);
    expect(result.refreshed).toEqual(units);
  });

  it("oldestCollectedAt은 사용한 단위 중 가장 오래된 수집 시각이다", async () => {
    const [fresh, older, missing] = [unitOf("202401"), unitOf("202402"), unitOf("202403")];
    const olderAt = addDays(now, -(COLLECTION.pastRefreshDays - 1));
    await repo.recordCollection(fresh, 1, addDays(now, -1));
    await repo.recordCollection(older, 1, olderAt);

    const result = await ensureCollected([fresh, older, missing], {
      repo,
      fetchTrades: fakeFetchTrades(),
      now: () => now,
    });

    expect(result.skipped).toEqual([fresh, older]);
    expect(result.oldestCollectedAt).toEqual(olderAt);
  });

  it("실패한 단위도 이전 수집분이 있으면 그 시각을 oldestCollectedAt에 반영한다", async () => {
    const stale = unitOf("202401");
    const staleAt = addDays(now, -COLLECTION.pastRefreshDays * 2);
    await repo.recordCollection(stale, 1, staleAt);

    const result = await ensureCollected([stale, unitOf("202402")], {
      repo,
      fetchTrades: fakeFetchTrades({ "11440|202401": apiError() }),
      now: () => now,
    });

    expect(result.failed.map((f) => f.unit)).toEqual([stale]);
    expect(result.oldestCollectedAt).toEqual(staleAt);
  });

  it("사용한 단위가 없으면 oldestCollectedAt은 null이다", async () => {
    const result = await ensureCollected([unit], {
      repo,
      fetchTrades: fakeFetchTrades({ "11440|202408": apiError() }),
      now: () => now,
    });

    expect(result.oldestCollectedAt).toBeNull();
    expect(result.refreshed).toEqual([]);
  });

  it("PublicDataError가 아닌 오류는 설정·코드 문제이므로 그대로 던진다", async () => {
    const fetch = fakeFetchTrades({ "11440|202408": new TypeError("boom") });

    await expect(ensureCollected([unit], { repo, fetchTrades: fetch, now: () => now })).rejects.toThrow(
      TypeError,
    );
  });
});
