import "dotenv/config";

import type { CollectDeps } from "@/server/trades/collect";
import { monthRange } from "@/server/trades/months";
import type { CollectionUnit } from "@/server/trades/repository";

type FetchParams = Parameters<CollectDeps["fetchTrades"]>[0];

import { COLLECT_USAGE, type CollectArgs, CollectArgsError, parseCollectArgs } from "./collect-args";

// npm run collect — 지역·계약월 단위 실거래가 배치 수집(ADR-004).
// 인자 파싱과 호출만 한다. 수집 로직은 온디맨드 보충과 공유하는 src/server/trades/collect.ts에 있다.
// server-only 모듈을 쓰므로 tsx --conditions=react-server로 실행한다(ARCHITECTURE server 규칙).

async function main(): Promise<number> {
  let args: CollectArgs;
  try {
    args = parseCollectArgs(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof CollectArgsError)) throw error;
    console.error(`오류: ${error.message}\n\n${COLLECT_USAGE}`);
    return 1;
  }

  const units = toUnits(args);
  console.log(`수집 단위 ${units.length}개 (${args.from}~${args.to}${args.force ? ", --force" : ""})`);

  if (args.dryRun) {
    for (const unit of units) console.log(`  ${label(unit)}`);
    return 0;
  }

  // --dry-run에서 DB·API 모듈을 불러오지 않도록 실제 실행 때만 import한다.
  const [{ db }, { createPrismaTradeRepository }, { fetchTrades }, { PublicDataError }] = await Promise.all([
    import("@/server/db"),
    import("@/server/trades/prisma-repository"),
    import("@/server/public-data/molit-trade"),
    import("@/server/public-data/http"),
  ]);
  const { collectUnit, ensureCollected } = await import("@/server/trades/collect");

  const deps: CollectDeps = {
    repo: createPrismaTradeRepository(db),
    fetchTrades,
    now: () => new Date(),
  };
  const failed: { unit: CollectionUnit; message: string }[] = [];

  try {
    if (args.force) {
      for (const [index, unit] of units.entries()) {
        const prefix = `[${index + 1}/${units.length}] ${label(unit)}`;
        try {
          const { fetched, inserted, updated } = await collectUnit(unit, deps);
          console.log(`${prefix} 받음 ${fetched} · 새로 ${inserted} · 갱신 ${updated}`);
        } catch (error) {
          if (!(error instanceof PublicDataError)) throw error;
          console.log(`${prefix} 실패: ${error.message}`);
          failed.push({ unit, message: error.message });
          // 호출 한도를 넘기면 남은 단위도 실패하므로 더 호출하지 않는다.
          if (error.kind === "quota") {
            for (const rest of units.slice(index + 1)) failed.push({ unit: rest, message: error.message });
            break;
          }
        }
      }
    } else {
      // 신선도 판단과 동시성·quota 처리는 ensureCollected에 맡기고, 단위별 건수를 출력하려고 의존성만 감싼다.
      // collectUnit은 받은 배열을 그대로 upsertTrades에 넘기므로 배열로 단위를 찾고, 기록 시점에 한 줄 출력한다.
      const unitOf = new WeakMap<object, FetchParams>();
      const counts = new Map<string, { inserted: number; updated: number }>();
      let done = 0;
      const result = await ensureCollected(units, {
        ...deps,
        fetchTrades: async (params) => {
          const trades = await fetchTrades(params);
          unitOf.set(trades, params);
          return trades;
        },
        repo: {
          ...deps.repo,
          async upsertTrades(trades) {
            const outcome = await deps.repo.upsertTrades(trades);
            const unit = unitOf.get(trades);
            if (unit) counts.set(label(unit), outcome);
            return outcome;
          },
          async recordCollection(unit, itemCount, collectedAt) {
            await deps.repo.recordCollection(unit, itemCount, collectedAt);
            const { inserted, updated } = counts.get(label(unit)) ?? { inserted: 0, updated: 0 };
            done += 1;
            console.log(`[${done}] ${label(unit)} 받음 ${itemCount} · 새로 ${inserted} · 갱신 ${updated}`);
          },
        },
      });
      for (const unit of result.skipped) console.log(`  건너뜀(신선함) ${label(unit)}`);
      for (const { unit, error } of result.failed) failed.push({ unit, message: error.message });
    }
  } finally {
    await db.$disconnect();
  }

  if (failed.length > 0) {
    console.error(`\n실패 ${failed.length}개:`);
    for (const { unit, message } of failed) console.error(`  ${label(unit)} — ${message}`);
    return 1;
  }
  console.log("\n완료");
  return 0;
}

function toUnits(args: CollectArgs): CollectionUnit[] {
  const months = monthRange(args.from, args.to);
  return args.lawdCds.flatMap((lawdCd) =>
    months.flatMap((dealYmd) =>
      args.houseTypes.flatMap((houseType) =>
        args.dealKinds.map((dealKind) => ({ lawdCd, dealYmd, houseType, dealKind })),
      ),
    ),
  );
}

function label(unit: CollectionUnit): string {
  return `${unit.lawdCd} ${unit.dealYmd} ${unit.houseType} ${unit.dealKind}`;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
