import "server-only";

import { randomUUID } from "node:crypto";

import { db } from "../db";
import { Prisma, type PrismaClient, type Trade } from "../generated/prisma/client";
import type { RawTrade } from "../public-data/molit-trade";
import { dedupeByKey, type StoredTrade, type TradeRepository } from "./repository";

// 실거래가 캐시의 Prisma 구현(ADR-003, ADR-004).

// 한 INSERT 문에 넣는 행 수. 행당 파라미터 18개라 PostgreSQL 한도(65535)보다 넉넉히 작다.
const UPSERT_BATCH_SIZE = 500;

export function createPrismaTradeRepository(client: PrismaClient = db): TradeRepository {
  return {
    async upsertTrades(input) {
      const trades = dedupeByKey(input);
      if (trades.length === 0) return { inserted: 0, updated: 0 };

      const statements = chunk(trades, UPSERT_BATCH_SIZE).map((batch) =>
        client.$queryRaw<{ inserted: boolean }[]>(upsertSql(batch)),
      );
      // 전부 반영되거나 전부 롤백되도록 한 트랜잭션으로 묶는다.
      const results = await client.$transaction(statements);

      const rows = results.flat();
      const inserted = rows.filter((row) => row.inserted).length;
      return { inserted, updated: rows.length - inserted };
    },

    async recordCollection(unit, itemCount, collectedAt) {
      await client.collectionLog.upsert({
        where: { lawdCd_dealYmd_houseType_dealKind: unit },
        create: { ...unit, itemCount, collectedAt },
        update: { itemCount, collectedAt },
      });
    },

    async getCollection(unit) {
      return client.collectionLog.findUnique({
        where: { lawdCd_dealYmd_houseType_dealKind: unit },
        select: { collectedAt: true, itemCount: true },
      });
    },

    async findSaleTrades(query) {
      const rows = await client.trade.findMany({
        where: {
          dealKind: "SALE",
          lawdCd: query.lawdCd,
          houseType: query.houseType,
          dealYmd: { gte: query.fromYmd, lte: query.toYmd },
          umdName: query.umdName,
          buildingKey: query.buildingKey,
        },
        orderBy: [{ contractDate: "asc" }, { id: "asc" }],
      });
      return rows.map(toStoredTrade);
    },
  };
}

/**
 * dedupKey 충돌 시 해제 표시와 변할 수 있는 필드만 갱신한다. 나머지 필드는 dedupKey에 들어 있어 바뀌지 않는다.
 * `xmax = 0`이면 이번 문장이 새로 넣은 행이다(갱신된 행은 xmax에 트랜잭션 id가 남는다).
 * id(cuid)와 updatedAt은 Prisma 클라이언트가 채우는 값이라 raw SQL에서는 직접 넣는다.
 */
function upsertSql(batch: RawTrade[]): Prisma.Sql {
  const values = batch.map(
    (t) => Prisma.sql`(
      ${randomUUID()}, ${t.houseType}::"HouseType", ${t.dealKind}::"DealKind", ${t.lawdCd}, ${t.dealYmd},
      ${t.umdName}, ${t.jibun}, ${t.buildingName}, ${t.exclusiveArea.toString()}::numeric, ${t.floor}::int,
      ${toDateString(t.contractDate)}::date, ${t.priceManwon}::int, ${t.depositManwon}::int,
      ${t.monthlyRentManwon}::int, ${t.cancelled}, ${t.cancelledDate ? toDateString(t.cancelledDate) : null}::date,
      ${t.buildingKey}, ${t.dedupKey}, NOW()
    )`,
  );
  return Prisma.sql`
    INSERT INTO "Trade" (
      "id", "houseType", "dealKind", "lawdCd", "dealYmd",
      "umdName", "jibun", "buildingName", "exclusiveArea", "floor",
      "contractDate", "priceManwon", "depositManwon",
      "monthlyRentManwon", "cancelled", "cancelledDate",
      "buildingKey", "dedupKey", "updatedAt"
    )
    VALUES ${Prisma.join(values)}
    ON CONFLICT ("dedupKey") DO UPDATE SET
      "umdName" = EXCLUDED."umdName",
      "jibun" = EXCLUDED."jibun",
      "buildingName" = EXCLUDED."buildingName",
      "buildingKey" = EXCLUDED."buildingKey",
      "cancelled" = EXCLUDED."cancelled",
      "cancelledDate" = EXCLUDED."cancelledDate",
      "updatedAt" = NOW()
    RETURNING (xmax = 0) AS "inserted"
  `;
}

function toStoredTrade(row: Trade): StoredTrade {
  return {
    id: row.id,
    houseType: row.houseType,
    dealKind: row.dealKind,
    lawdCd: row.lawdCd,
    dealYmd: row.dealYmd,
    umdName: row.umdName,
    jibun: row.jibun,
    buildingName: row.buildingName,
    exclusiveArea: row.exclusiveArea.toNumber(),
    floor: row.floor,
    contractDate: row.contractDate,
    priceManwon: row.priceManwon,
    depositManwon: row.depositManwon,
    monthlyRentManwon: row.monthlyRentManwon,
    cancelled: row.cancelled,
    cancelledDate: row.cancelledDate,
    buildingKey: row.buildingKey,
    dedupKey: row.dedupKey,
  };
}

// @db.Date 컬럼에 넣을 날짜. 세션 타임존에 따라 날짜가 밀리지 않도록 UTC 날짜 문자열로 넘긴다.
function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
