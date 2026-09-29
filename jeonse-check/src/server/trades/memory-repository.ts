import "server-only";

import type { RawTrade } from "../public-data/molit-trade";
import {
  type CollectionUnit,
  dedupeByKey,
  type SaleTradeQuery,
  type StoredTrade,
  type TradeRepository,
} from "./repository";

// 테스트용 in-memory 구현. Prisma 구현과 같은 계약(repository.contract.ts)을 지킨다.
// 제품 코드 경로의 기본값으로 쓰지 않는다.

type CollectionEntry = { collectedAt: Date; itemCount: number };

export function createMemoryTradeRepository(): TradeRepository {
  const trades = new Map<string, StoredTrade>(); // dedupKey → 행
  const collections = new Map<string, CollectionEntry>();
  let nextId = 1;

  return {
    async upsertTrades(input) {
      let inserted = 0;
      let updated = 0;
      for (const trade of dedupeByKey(input)) {
        const existing = trades.get(trade.dedupKey);
        if (existing) {
          trades.set(trade.dedupKey, { ...existing, ...mutableFields(trade) });
          updated += 1;
        } else {
          trades.set(trade.dedupKey, { ...cloneTrade(trade), id: `mem-${nextId++}` });
          inserted += 1;
        }
      }
      return { inserted, updated };
    },

    async recordCollection(unit, itemCount, collectedAt) {
      collections.set(unitKey(unit), { collectedAt: new Date(collectedAt), itemCount });
    },

    async getCollection(unit) {
      const entry = collections.get(unitKey(unit));
      return entry ? { collectedAt: new Date(entry.collectedAt), itemCount: entry.itemCount } : null;
    },

    async findSaleTrades(query) {
      return [...trades.values()]
        .filter((trade) => matchesSaleQuery(trade, query))
        .sort((a, b) => a.contractDate.getTime() - b.contractDate.getTime())
        .map((trade) => ({ ...cloneTrade(trade), id: trade.id }));
    },
  };
}

// 이미 있는 행에서 갱신하는 필드. Prisma 구현의 ON CONFLICT DO UPDATE 대상과 같다.
function mutableFields(trade: RawTrade) {
  return {
    umdName: trade.umdName,
    jibun: trade.jibun,
    buildingName: trade.buildingName,
    buildingKey: trade.buildingKey,
    cancelled: trade.cancelled,
    cancelledDate: trade.cancelledDate ? new Date(trade.cancelledDate) : null,
  };
}

// 호출자가 넘긴 객체를 나중에 바꿔도 저장된 값이 변하지 않도록 복사한다.
function cloneTrade(trade: RawTrade): RawTrade {
  return {
    ...trade,
    contractDate: new Date(trade.contractDate),
    cancelledDate: trade.cancelledDate ? new Date(trade.cancelledDate) : null,
  };
}

function matchesSaleQuery(trade: StoredTrade, query: SaleTradeQuery): boolean {
  return (
    trade.dealKind === "SALE" &&
    trade.lawdCd === query.lawdCd &&
    trade.houseType === query.houseType &&
    trade.dealYmd >= query.fromYmd &&
    trade.dealYmd <= query.toYmd &&
    (query.umdName === undefined || trade.umdName === query.umdName) &&
    (query.buildingKey === undefined || trade.buildingKey === query.buildingKey)
  );
}

function unitKey(unit: CollectionUnit): string {
  return [unit.lawdCd, unit.dealYmd, unit.houseType, unit.dealKind].join("|");
}
