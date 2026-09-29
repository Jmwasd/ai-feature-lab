import "server-only";

import {
  assertPageLimit,
  MAX_SAVED_PER_USER,
  SavedLimitExceededError,
  type SavedRecord,
  type SavedResultRepository,
  type SavedSummary,
  summarizeResult,
} from "./repository";

// 테스트용 in-memory 구현. Prisma 구현과 같은 계약(repository.contract.ts)을 지킨다.
// 제품 코드 경로의 기본값으로 쓰지 않는다.

type Row = SavedRecord & { addressDisplay: string; signalCount: number };

export function createMemorySavedResultRepository(now: () => Date = () => new Date()): SavedResultRepository {
  const rows = new Map<string, Row>();
  let nextId = 1;

  const ownedBy = (userId: string, id: string): Row | undefined => {
    const row = rows.get(id);
    return row && row.userId === userId ? row : undefined;
  };

  return {
    async create(userId, data) {
      const summary = summarizeResult(data.result);
      const count = [...rows.values()].filter((row) => row.userId === userId).length;
      if (count >= MAX_SAVED_PER_USER) throw new SavedLimitExceededError();

      // 자리수를 맞춰 문자열 비교가 생성 순서와 같게 한다(createdAt이 같을 때의 정렬 기준).
      const id = `mem-${String(nextId++).padStart(8, "0")}`;
      rows.set(id, {
        id,
        userId,
        input: jsonClone(data.input),
        result: jsonClone(data.result),
        dataBaseDate: toUtcDate(data.dataBaseDate),
        createdAt: now(),
        ...summary,
      });
      return { id };
    },

    async listByUser(userId, { cursor, limit }) {
      assertPageLimit(limit);
      let owned = [...rows.values()].filter((row) => row.userId === userId).sort(newestFirst);
      if (cursor !== undefined) {
        const anchor = ownedBy(userId, cursor);
        if (!anchor) return { items: [], nextCursor: null };
        owned = owned.filter((row) => newestFirst(anchor, row) < 0);
      }
      const page = owned.slice(0, limit);
      return {
        items: page.map(toSummary),
        nextCursor: owned.length > limit ? page[page.length - 1].id : null,
      };
    },

    async getForUser(userId, id) {
      const row = ownedBy(userId, id);
      if (!row) return null;
      return {
        id: row.id,
        userId: row.userId,
        input: jsonClone(row.input),
        result: jsonClone(row.result),
        dataBaseDate: new Date(row.dataBaseDate),
        createdAt: new Date(row.createdAt),
      };
    },

    async deleteForUser(userId, id) {
      if (!ownedBy(userId, id)) return false;
      rows.delete(id);
      return true;
    },
  };
}

// createdAt 내림차순, 같으면 id 내림차순. Prisma 구현의 orderBy와 같다.
function newestFirst(a: Row, b: Row): number {
  const byTime = b.createdAt.getTime() - a.createdAt.getTime();
  if (byTime !== 0) return byTime;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

function toSummary(row: Row): SavedSummary {
  return {
    id: row.id,
    addressDisplay: row.addressDisplay,
    signalCount: row.signalCount,
    dataBaseDate: new Date(row.dataBaseDate),
    createdAt: new Date(row.createdAt),
  };
}

// Prisma Json 컬럼을 거친 것과 같은 모양으로 복사한다(Date는 문자열이 된다).
function jsonClone(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

// dataBaseDate 컬럼은 @db.Date라 시각을 버린다.
function toUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
