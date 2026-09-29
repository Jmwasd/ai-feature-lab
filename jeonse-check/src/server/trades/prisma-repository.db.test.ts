import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { requireLocalTestDatabaseUrl } from "../../test/test-database-url";
import { PrismaClient } from "../generated/prisma/client";
import type { RawTrade } from "../public-data/molit-trade";
import { buildingKeyOf, dedupKeyOf } from "../public-data/trade-keys";
import { createPrismaTradeRepository } from "./prisma-repository";
import { describeTradeRepositoryContract } from "./repository.contract";

// 실제 PostgreSQL(TEST_DATABASE_URL)에 붙는 통합 테스트. npm run test:db에서만 돈다.
const client = new PrismaClient({
  adapter: new PrismaPg({ connectionString: requireLocalTestDatabaseUrl(process.env.TEST_DATABASE_URL) }),
});

async function resetTables(): Promise<void> {
  await client.$executeRawUnsafe('TRUNCATE TABLE "Trade", "CollectionLog"');
}

afterAll(async () => {
  await client.$disconnect();
});

describeTradeRepositoryContract("prisma", async () => {
  await resetTables();
  return createPrismaTradeRepository(client);
});

type TradeFields = Omit<RawTrade, "buildingKey" | "dedupKey">;

// i마다 지역·계약월·층·가격이 달라 dedupKey가 모두 다른 거래
function tradeAt(i: number, overrides: Partial<TradeFields> = {}): RawTrade {
  const month = (i % 12) + 1;
  const fields: TradeFields = {
    houseType: i % 2 === 0 ? "ROW_HOUSE" : "APARTMENT",
    dealKind: "SALE",
    lawdCd: i % 3 === 0 ? "11440" : "11410",
    dealYmd: `2024${String(month).padStart(2, "0")}`,
    umdName: "망원동",
    jibun: `${100 + (i % 50)}-1`,
    buildingName: `테스트빌${i % 50}`,
    exclusiveArea: 59.9,
    floor: (i % 20) + 1,
    contractDate: new Date(Date.UTC(2024, month - 1, (i % 28) + 1)),
    priceManwon: 10000 + i,
    depositManwon: null,
    monthlyRentManwon: null,
    cancelled: false,
    cancelledDate: null,
    ...overrides,
  };
  return { ...fields, buildingKey: buildingKeyOf(fields), dedupKey: dedupKeyOf(fields) };
}

describe("Prisma TradeRepository 대량 upsert", () => {
  const repo = createPrismaTradeRepository(client);

  beforeEach(resetTables);

  it("1,500건을 배치로 넣고 다시 넣어도 행 수가 그대로다", async () => {
    const trades = Array.from({ length: 1500 }, (_, i) => tradeAt(i));

    expect(await repo.upsertTrades(trades)).toEqual({ inserted: 1500, updated: 0 });
    expect(await client.trade.count()).toBe(1500);

    expect(await repo.upsertTrades(trades)).toEqual({ inserted: 0, updated: 1500 });
    expect(await client.trade.count()).toBe(1500);
  });

  it("재수집에서 해제 표시를 갱신하고 새 거래와 기존 거래를 따로 센다", async () => {
    const originals = Array.from({ length: 1200 }, (_, i) => tradeAt(i));
    await repo.upsertTrades(originals);
    const idsBefore = new Map((await client.trade.findMany()).map((row) => [row.dedupKey, row.id]));

    const cancelledDate = new Date(Date.UTC(2024, 11, 20));
    const recollected = [
      ...Array.from({ length: 1200 }, (_, i) => (i % 3 === 0 ? tradeAt(i, { cancelled: true, cancelledDate }) : tradeAt(i))),
      ...Array.from({ length: 300 }, (_, i) => tradeAt(1200 + i)),
    ];

    expect(await repo.upsertTrades(recollected)).toEqual({ inserted: 300, updated: 1200 });
    expect(await client.trade.count()).toBe(1500);
    expect(await client.trade.count({ where: { cancelled: true } })).toBe(400);

    const cancelledRow = await client.trade.findUniqueOrThrow({ where: { dedupKey: originals[0].dedupKey } });
    expect(cancelledRow.cancelled).toBe(true);
    expect(cancelledRow.cancelledDate).toEqual(cancelledDate);
    expect(cancelledRow.id).toBe(idsBefore.get(originals[0].dedupKey));

    const untouched = await client.trade.findUniqueOrThrow({ where: { dedupKey: originals[1].dedupKey } });
    expect(untouched.cancelled).toBe(false);
    expect(untouched.cancelledDate).toBeNull();
  });
});
