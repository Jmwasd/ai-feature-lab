import "server-only";

import { db } from "../db";
import { fetchBuildingRecords } from "../public-data/building";
import { fetchTrades } from "../public-data/molit-trade";
import { fetchOfficialPrice } from "../public-data/official-price";
import { createPrismaTradeRepository } from "../trades/prisma-repository";
import type { LookupDeps } from "./collect-inputs";

// 운영 의존성: Prisma 저장소 + 실제 공공데이터 어댑터.
// collect-inputs.ts와 나눈 이유는 테스트가 Prisma 클라이언트를 불러오지 않게 하기 위해서다.
export function defaultLookupDeps(): LookupDeps {
  return {
    repo: createPrismaTradeRepository(db),
    fetchTrades,
    fetchOfficialPrice: (params) => fetchOfficialPrice(params),
    fetchBuildingRecords: (address) => fetchBuildingRecords(address),
    now: () => new Date(),
  };
}
