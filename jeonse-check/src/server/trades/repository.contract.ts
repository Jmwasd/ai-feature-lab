import "server-only";

import { beforeEach, describe, expect, it } from "vitest";

import type { RawTrade } from "../public-data/molit-trade";
import { buildingKeyOf, dedupKeyOf } from "../public-data/trade-keys";
import type { CollectionUnit, TradeRepository } from "./repository";

type TradeFields = Omit<RawTrade, "buildingKey" | "dedupKey">;

const base: TradeFields = {
  houseType: "ROW_HOUSE",
  dealKind: "SALE",
  lawdCd: "11440",
  dealYmd: "202408",
  umdName: "망원동",
  jibun: "412-7",
  buildingName: "망원하이빌",
  exclusiveArea: 59.9,
  floor: 3,
  contractDate: new Date(Date.UTC(2024, 7, 12)),
  priceManwon: 45000,
  depositManwon: null,
  monthlyRentManwon: null,
  cancelled: false,
  cancelledDate: null,
};

function makeTrade(overrides: Partial<TradeFields> = {}): RawTrade {
  const fields = { ...base, ...overrides };
  return { ...fields, buildingKey: buildingKeyOf(fields), dedupKey: dedupKeyOf(fields) };
}

// 계약월 YYYYMM의 12일 거래
function tradeIn(dealYmd: string, overrides: Partial<TradeFields> = {}): RawTrade {
  const year = Number(dealYmd.slice(0, 4));
  const month = Number(dealYmd.slice(4, 6)) - 1;
  return makeTrade({ dealYmd, contractDate: new Date(Date.UTC(year, month, 12)), ...overrides });
}

const saleQuery = { lawdCd: "11440", houseType: "ROW_HOUSE", fromYmd: "202401", toYmd: "202412" } as const;

const unit: CollectionUnit = { lawdCd: "11440", dealYmd: "202408", houseType: "ROW_HOUSE", dealKind: "SALE" };

/**
 * TradeRepository 구현이 지켜야 할 계약. in-memory 구현과 Prisma 구현에 같은 테스트를 적용한다.
 * makeRepo는 테스트마다 빈 저장소를 돌려줘야 한다.
 */
export function describeTradeRepositoryContract(
  name: string,
  makeRepo: () => TradeRepository | Promise<TradeRepository>,
): void {
  describe(`TradeRepository 계약: ${name}`, () => {
    let repo: TradeRepository;

    beforeEach(async () => {
      repo = await makeRepo();
    });

    describe("upsertTrades", () => {
      it("빈 배열은 아무것도 하지 않는다", async () => {
        expect(await repo.upsertTrades([])).toEqual({ inserted: 0, updated: 0 });
      });

      it("새 거래를 넣고 필드를 그대로 돌려준다", async () => {
        const trade = makeTrade();
        expect(await repo.upsertTrades([trade])).toEqual({ inserted: 1, updated: 0 });

        const [stored] = await repo.findSaleTrades(saleQuery);
        expect(stored).toEqual({ ...trade, id: expect.any(String) });
      });

      it("같은 거래를 두 번 넣으면 행은 1개이고 두 번째는 updated로 센다", async () => {
        const trade = makeTrade();
        await repo.upsertTrades([trade]);
        const [first] = await repo.findSaleTrades(saleQuery);

        expect(await repo.upsertTrades([makeTrade()])).toEqual({ inserted: 0, updated: 1 });
        const rows = await repo.findSaleTrades(saleQuery);
        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe(first.id);
      });

      it("해제 표시가 바뀐 재수집은 같은 행을 갱신한다", async () => {
        await repo.upsertTrades([makeTrade()]);
        const cancelledDate = new Date(Date.UTC(2024, 8, 3));

        const result = await repo.upsertTrades([makeTrade({ cancelled: true, cancelledDate })]);
        expect(result).toEqual({ inserted: 0, updated: 1 });

        const rows = await repo.findSaleTrades(saleQuery);
        expect(rows).toHaveLength(1);
        expect(rows[0].cancelled).toBe(true);
        expect(rows[0].cancelledDate).toEqual(cancelledDate);
      });

      it("새 거래와 기존 거래가 섞이면 각각 센다", async () => {
        await repo.upsertTrades([makeTrade()]);
        const result = await repo.upsertTrades([makeTrade(), makeTrade({ floor: 4 })]);
        expect(result).toEqual({ inserted: 1, updated: 1 });
        expect(await repo.findSaleTrades(saleQuery)).toHaveLength(2);
      });

      it("한 호출 안의 중복 키는 마지막 것만 반영하고 한 건으로 센다", async () => {
        const cancelledDate = new Date(Date.UTC(2024, 8, 3));
        const result = await repo.upsertTrades([makeTrade(), makeTrade({ cancelled: true, cancelledDate })]);
        expect(result).toEqual({ inserted: 1, updated: 0 });

        const rows = await repo.findSaleTrades(saleQuery);
        expect(rows).toHaveLength(1);
        expect(rows[0].cancelled).toBe(true);
      });

      it("많은 거래를 한 번에 넣는다", async () => {
        const trades = Array.from({ length: 1234 }, (_, i) => makeTrade({ priceManwon: 10000 + i }));
        expect(await repo.upsertTrades(trades)).toEqual({ inserted: 1234, updated: 0 });
        expect(await repo.upsertTrades(trades)).toEqual({ inserted: 0, updated: 1234 });
        expect(await repo.findSaleTrades(saleQuery)).toHaveLength(1234);
      });
    });

    describe("findSaleTrades", () => {
      it("계약월 범위의 양 끝을 포함하고 계약일 오름차순으로 돌려준다", async () => {
        await repo.upsertTrades(["202405", "202401", "202403", "202402", "202404"].map((ymd) => tradeIn(ymd)));

        const rows = await repo.findSaleTrades({ ...saleQuery, fromYmd: "202402", toYmd: "202404" });
        expect(rows.map((row) => row.dealYmd)).toEqual(["202402", "202403", "202404"]);
      });

      it("전월세, 다른 지역, 다른 주택유형은 돌려주지 않는다", async () => {
        await repo.upsertTrades([
          makeTrade(),
          makeTrade({ dealKind: "LEASE", priceManwon: null, depositManwon: 30000 }),
          makeTrade({ lawdCd: "11410" }),
          makeTrade({ houseType: "APARTMENT" }),
        ]);

        const rows = await repo.findSaleTrades(saleQuery);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ dealKind: "SALE", lawdCd: "11440", houseType: "ROW_HOUSE" });
      });

      it("해제 거래도 돌려준다", async () => {
        await repo.upsertTrades([makeTrade({ cancelled: true, cancelledDate: new Date(Date.UTC(2024, 8, 3)) })]);
        const rows = await repo.findSaleTrades(saleQuery);
        expect(rows).toHaveLength(1);
        expect(rows[0].cancelled).toBe(true);
      });

      it("umdName, buildingKey로 좁힌다", async () => {
        const target = makeTrade();
        await repo.upsertTrades([
          target,
          makeTrade({ jibun: "500", buildingName: "다른빌" }),
          makeTrade({ umdName: "합정동", jibun: "369" }),
        ]);

        expect(await repo.findSaleTrades({ ...saleQuery, umdName: "합정동" })).toHaveLength(1);
        const byBuilding = await repo.findSaleTrades({ ...saleQuery, buildingKey: target.buildingKey });
        expect(byBuilding.map((row) => row.dedupKey)).toEqual([target.dedupKey]);
        expect(
          await repo.findSaleTrades({ ...saleQuery, umdName: "합정동", buildingKey: target.buildingKey }),
        ).toEqual([]);
      });

      it("전용면적을 number로 돌려준다", async () => {
        await repo.upsertTrades([makeTrade({ exclusiveArea: 84.9876 })]);
        const [row] = await repo.findSaleTrades(saleQuery);
        expect(row.exclusiveArea).toBe(84.9876);
      });
    });

    describe("recordCollection / getCollection", () => {
      it("기록 전에는 null이다", async () => {
        expect(await repo.getCollection(unit)).toBeNull();
      });

      it("기록한 수집 시각과 건수를 돌려주고, 다시 기록하면 덮어쓴다", async () => {
        await repo.recordCollection(unit, 10, new Date("2024-09-01T00:00:00Z"));
        expect(await repo.getCollection(unit)).toEqual({
          collectedAt: new Date("2024-09-01T00:00:00Z"),
          itemCount: 10,
        });

        await repo.recordCollection(unit, 12, new Date("2024-09-15T00:00:00Z"));
        expect(await repo.getCollection(unit)).toEqual({
          collectedAt: new Date("2024-09-15T00:00:00Z"),
          itemCount: 12,
        });
      });

      it("수집 단위의 네 필드가 모두 같아야 같은 기록이다", async () => {
        await repo.recordCollection(unit, 10, new Date("2024-09-01T00:00:00Z"));
        expect(await repo.getCollection({ ...unit, dealKind: "LEASE" })).toBeNull();
        expect(await repo.getCollection({ ...unit, houseType: "APARTMENT" })).toBeNull();
        expect(await repo.getCollection({ ...unit, dealYmd: "202409" })).toBeNull();
        expect(await repo.getCollection({ ...unit, lawdCd: "11410" })).toBeNull();
      });
    });
  });
}
