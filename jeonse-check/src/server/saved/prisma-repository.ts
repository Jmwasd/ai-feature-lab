import "server-only";

import { db } from "../db";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import {
  assertPageLimit,
  MAX_SAVED_PER_USER,
  SavedLimitExceededError,
  type SavedResultRepository,
  summarizeResult,
} from "./repository";

// 저장 결과의 Prisma 구현(ADR-003). 모든 조회·삭제 조건에 userId를 넣는다.

const summarySelect = {
  id: true,
  addressDisplay: true,
  signalCount: true,
  dataBaseDate: true,
  createdAt: true,
} satisfies Prisma.SavedResultSelect;

const newestFirst = [{ createdAt: "desc" }, { id: "desc" }] satisfies Prisma.SavedResultOrderByWithRelationInput[];

export function createPrismaSavedResultRepository(
  client: PrismaClient = db,
  now: () => Date = () => new Date(),
): SavedResultRepository {
  return {
    async create(userId, data) {
      const summary = summarizeResult(data.result);
      // 동시 요청이 겹치면 상한을 조금 넘을 수 있다. 저장 공간 보호용이라 그 정도는 허용한다.
      if ((await client.savedResult.count({ where: { userId } })) >= MAX_SAVED_PER_USER) {
        throw new SavedLimitExceededError();
      }
      return client.savedResult.create({
        data: {
          userId,
          input: data.input as Prisma.InputJsonValue,
          result: data.result as Prisma.InputJsonValue,
          dataBaseDate: data.dataBaseDate,
          createdAt: now(),
          ...summary,
        },
        select: { id: true },
      });
    },

    async listByUser(userId, { cursor, limit }) {
      assertPageLimit(limit);
      let after: Prisma.SavedResultWhereInput = {};
      if (cursor !== undefined) {
        const anchor = await client.savedResult.findFirst({
          where: { id: cursor, userId },
          select: { id: true, createdAt: true },
        });
        if (!anchor) return { items: [], nextCursor: null };
        after = {
          OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }],
        };
      }

      // 한 건 더 읽어 다음 페이지가 있는지 본다.
      const rows = await client.savedResult.findMany({
        where: { userId, ...after },
        orderBy: newestFirst,
        take: limit + 1,
        select: summarySelect,
      });
      const items = rows.slice(0, limit);
      return { items, nextCursor: rows.length > limit ? items[items.length - 1].id : null };
    },

    async getForUser(userId, id) {
      return client.savedResult.findFirst({
        where: { id, userId },
        select: { id: true, userId: true, input: true, result: true, dataBaseDate: true, createdAt: true },
      });
    },

    async deleteForUser(userId, id) {
      const { count } = await client.savedResult.deleteMany({ where: { id, userId } });
      return count > 0;
    },
  };
}
