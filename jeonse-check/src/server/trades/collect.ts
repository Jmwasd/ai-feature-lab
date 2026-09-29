import "server-only";

import { COLLECTION, PRICE_ESTIMATE } from "@/consts/policy";

import { PublicDataError } from "../public-data/http";
import type { fetchTrades } from "../public-data/molit-trade";
import type { CollectionUnit, TradeRepository } from "./repository";

// 실거래가 수집 단위 하나를 API → 저장 → 로그까지 처리한다.
// CLI(npm run collect)와 조회 시 온디맨드 보충이 같은 함수를 쓴다(ADR-004).

// API 호출 한도가 있어 동시 호출을 낮게 둔다. 정책 수치가 아니라 통신 설정이다.
const DEFAULT_CONCURRENCY = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CollectDeps {
  repo: TradeRepository;
  fetchTrades: typeof fetchTrades;
  now: () => Date;
}

export interface EnsureResult {
  refreshed: CollectionUnit[];
  skipped: CollectionUnit[];
  failed: { unit: CollectionUnit; error: PublicDataError }[];
  /** 사용한 단위 중 가장 오래된 수집 시각 → 결과의 데이터 기준일 */
  oldestCollectedAt: Date | null;
}

/**
 * API 호출 → upsert → 수집 로그 순서로 처리한다. API가 실패하면 저장도 로그도 하지 않고 오류를 던진다.
 * 실패한 단위가 "수집됨"으로 기록되면 다시 받지 않기 때문이다. 결과 0건은 정상이며 로그를 남긴다.
 */
export async function collectUnit(
  unit: CollectionUnit,
  deps: CollectDeps,
): Promise<{ fetched: number; inserted: number; updated: number }> {
  const { fetched, inserted, updated } = await collectAndRecord(unit, deps);
  return { fetched, inserted, updated };
}

async function collectAndRecord(unit: CollectionUnit, deps: CollectDeps) {
  const trades = await deps.fetchTrades({
    lawdCd: unit.lawdCd,
    dealYmd: unit.dealYmd,
    houseType: unit.houseType,
    dealKind: unit.dealKind,
  });
  const { inserted, updated } = await deps.repo.upsertTrades(trades);
  const collectedAt = deps.now();
  await deps.repo.recordCollection(unit, trades.length, collectedAt);
  return { fetched: trades.length, inserted, updated, collectedAt };
}

/**
 * 캐시를 다시 받아야 하는지 판단한다.
 * - 최근 월(계약월 신고 기간이 안 끝남): 수집 후 recentRefreshDays가 지나면 다시 받는다.
 * - 과거 월: 신고 기간 중에 수집했으면 늦은 신고를 위해 한 번 더 받고, 그 뒤로는 해제 반영을 위해
 *   pastRefreshDays마다 다시 받는다.
 */
export function needsRefresh(
  unit: CollectionUnit,
  log: { collectedAt: Date } | null,
  now: Date,
): boolean {
  if (!log) return true;
  const age = now.getTime() - log.collectedAt.getTime();
  const closesAt = reportingClosesAt(unit.dealYmd);
  if (now.getTime() < closesAt) return age >= COLLECTION.recentRefreshDays * DAY_MS;
  if (log.collectedAt.getTime() < closesAt) return true;
  return age >= COLLECTION.pastRefreshDays * DAY_MS;
}

/**
 * needsRefresh가 참인 단위만 받는다. 한 단위가 실패해도 나머지는 계속한다.
 * quota 오류가 나면 아직 시작하지 않은 단위는 호출하지 않고 같은 오류로 failed에 넣는다.
 * PublicDataError가 아닌 오류(환경변수 누락, 잘못된 인자 등)는 그대로 던진다.
 */
export async function ensureCollected(
  units: CollectionUnit[],
  deps: CollectDeps & { concurrency?: number },
): Promise<EnsureResult> {
  const concurrency = Math.max(1, deps.concurrency ?? DEFAULT_CONCURRENCY);
  const now = deps.now();

  const logs = await Promise.all(units.map((unit) => deps.repo.getCollection(unit)));
  const pending = units.flatMap((unit, index) =>
    needsRefresh(unit, logs[index] ?? null, now) ? [index] : [],
  );

  // 입력 순서를 지키기 위해 단위 인덱스별로 결과를 모은다.
  const outcomes = new Map<number, { collectedAt: Date } | { error: PublicDataError }>();
  let quotaError: PublicDataError | null = null;
  let aborted = false; // PublicDataError가 아닌 오류로 전체를 멈춘다
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (!aborted && cursor < pending.length) {
      const index = pending[cursor++]!;
      if (quotaError) {
        outcomes.set(index, { error: quotaError });
        continue;
      }
      try {
        const { collectedAt } = await collectAndRecord(units[index]!, deps);
        outcomes.set(index, { collectedAt });
      } catch (error) {
        if (!(error instanceof PublicDataError)) {
          aborted = true;
          throw error;
        }
        if (error.kind === "quota") quotaError ??= error;
        outcomes.set(index, { error });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));

  const result: EnsureResult = { refreshed: [], skipped: [], failed: [], oldestCollectedAt: null };
  const usedAt: Date[] = [];
  units.forEach((unit, index) => {
    const previous = logs[index] ?? null;
    const outcome = outcomes.get(index);
    if (!outcome) {
      result.skipped.push(unit);
      if (previous) usedAt.push(previous.collectedAt);
    } else if ("error" in outcome) {
      result.failed.push({ unit, error: outcome.error });
      // 새로 받지 못해도 이전 수집분은 조회에 쓰이므로 기준일에 반영한다.
      if (previous) usedAt.push(previous.collectedAt);
    } else {
      result.refreshed.push(unit);
      usedAt.push(outcome.collectedAt);
    }
  });
  result.oldestCollectedAt = usedAt.reduce<Date | null>(
    (oldest, at) => (oldest === null || at < oldest ? at : oldest),
    null,
  );
  return result;
}

// 계약월 신고 기간이 끝나는 시각: 다음 달 1일 0시(UTC) + 신고 지연 일수
function reportingClosesAt(dealYmd: string): number {
  const year = Number(dealYmd.slice(0, 4));
  const month = Number(dealYmd.slice(4, 6)); // 1~12. Date.UTC의 월 인자로 쓰면 다음 달이 된다.
  return Date.UTC(year, month, 1) + PRICE_ESTIMATE.reportingDelayDays * DAY_MS;
}
