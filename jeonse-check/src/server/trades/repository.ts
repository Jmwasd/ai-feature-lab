import "server-only";

import type { RawTrade, TradeDealKind, TradeHouseType } from "../public-data/molit-trade";

// 실거래가 캐시 저장소. 운영은 Prisma 구현, 테스트는 in-memory 구현을 쓴다.
// 두 구현은 repository.contract.ts의 같은 계약 테스트를 통과해야 한다.

// 수집 단위(지역×계약월×주택유형×거래유형). CollectionLog 한 행과 대응한다.
export interface CollectionUnit {
  lawdCd: string;
  dealYmd: string;
  houseType: TradeHouseType;
  dealKind: TradeDealKind;
}

export interface StoredTrade extends RawTrade {
  id: string;
}

export interface SaleTradeQuery {
  lawdCd: string;
  houseType: TradeHouseType;
  fromYmd: string; // 포함
  toYmd: string; // 포함
  umdName?: string;
  buildingKey?: string;
}

export interface TradeRepository {
  /**
   * dedupKey 기준 멱등 upsert. 이미 있는 행은 해제 표시와 변할 수 있는 필드만 갱신한다.
   * 한 번의 호출 안에서 같은 dedupKey가 여러 번 오면 마지막 것만 반영하고 한 건으로 센다.
   */
  upsertTrades(trades: RawTrade[]): Promise<{ inserted: number; updated: number }>;
  recordCollection(unit: CollectionUnit, itemCount: number, collectedAt: Date): Promise<void>;
  getCollection(unit: CollectionUnit): Promise<{ collectedAt: Date; itemCount: number } | null>;
  /** 매매 거래를 계약일 오름차순으로 돌려준다. 해제 거래도 포함한다(제외는 판정 단계). */
  findSaleTrades(query: SaleTradeQuery): Promise<StoredTrade[]>;
}

/** 같은 dedupKey는 마지막 것만 남긴다. 순서는 각 키가 처음 나온 위치를 따른다. */
export function dedupeByKey(trades: RawTrade[]): RawTrade[] {
  const byKey = new Map<string, RawTrade>();
  for (const trade of trades) byKey.set(trade.dedupKey, trade);
  return [...byKey.values()];
}
