import "server-only";

import { beforeEach, describe, expect, it } from "vitest";

import { MAX_SAVED_PER_USER, SavedLimitExceededError, type SavedResultRepository } from "./repository";

// 테스트마다 1분씩 흐르는 시계. 생성 순서가 곧 createdAt 순서가 되게 한다.
export function makeTickingClock(start = Date.UTC(2026, 8, 1, 0, 0, 0)): () => Date {
  let current = start;
  return () => {
    const now = new Date(current);
    current += 60_000;
    return now;
  };
}

// 호출할 때마다 같은 시각을 돌려주는 시계. createdAt이 같을 때 커서가 빠짐없이 넘기는지 본다.
export function makeFrozenClock(at = Date.UTC(2026, 8, 1, 0, 0, 0)): () => Date {
  return () => new Date(at);
}

export const USER_A = "user-a";
export const USER_B = "user-b";

const dataBaseDate = new Date(Date.UTC(2026, 7, 31));

function savedData(address: string, signalCount = 2) {
  return {
    input: { address, deposit: 200_000_000, rights: { mortgageMaxAmount: 100_000_000 } },
    result: {
      version: 1,
      address: { display: address },
      report: { signalCount, headline: `위험 신호 ${signalCount}개` },
    },
    dataBaseDate,
  };
}

/**
 * SavedResultRepository 구현이 지켜야 할 계약. in-memory 구현과 Prisma 구현에 같은 테스트를 적용한다.
 * makeRepo는 테스트마다 빈 저장소를 돌려줘야 하고, 받은 시계로 createdAt을 정해야 한다.
 * USER_A, USER_B는 저장소가 참조할 수 있는 사용자로 미리 있어야 한다(Prisma는 외래키가 있다).
 */
export function describeSavedRepositoryContract(
  name: string,
  makeRepo: (now: () => Date) => SavedResultRepository | Promise<SavedResultRepository>,
): void {
  describe(`SavedResultRepository 계약: ${name}`, () => {
    let repo: SavedResultRepository;

    beforeEach(async () => {
      repo = await makeRepo(makeTickingClock());
    });

    describe("create / getForUser", () => {
      it("저장한 입력·결과·기준일을 그대로 돌려준다", async () => {
        const data = savedData("서울 마포구 망원동 412-7");
        const { id } = await repo.create(USER_A, data);

        const record = await repo.getForUser(USER_A, id);

        expect(record).toEqual({
          id,
          userId: USER_A,
          input: data.input,
          result: data.result,
          dataBaseDate,
          createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, 0)),
        });
      });

      it("저장 후 호출자가 원본 객체를 바꿔도 저장된 값은 변하지 않는다", async () => {
        const data = savedData("서울 마포구 망원동 412-7");
        const { id } = await repo.create(USER_A, data);
        data.input.address = "바뀐 주소";

        const record = await repo.getForUser(USER_A, id);

        expect(record?.input).toMatchObject({ address: "서울 마포구 망원동 412-7" });
      });

      it("다른 사용자의 결과는 null이다", async () => {
        const { id } = await repo.create(USER_A, savedData("서울 마포구 망원동 412-7"));

        expect(await repo.getForUser(USER_B, id)).toBeNull();
      });

      it("없는 id는 null이다", async () => {
        expect(await repo.getForUser(USER_A, "no-such-id")).toBeNull();
      });

      it("result에서 주소나 신호 수를 읽을 수 없으면 저장하지 않는다", async () => {
        await expect(
          repo.create(USER_A, { input: {}, result: { report: { signalCount: 1 } }, dataBaseDate }),
        ).rejects.toThrow(TypeError);
        await expect(
          repo.create(USER_A, { input: {}, result: { address: { display: "주소" } }, dataBaseDate }),
        ).rejects.toThrow(TypeError);

        expect((await repo.listByUser(USER_A, { limit: 10 })).items).toEqual([]);
      });

      it(`사용자당 ${MAX_SAVED_PER_USER}개를 넘겨 저장하지 않는다`, async () => {
        for (let i = 0; i < MAX_SAVED_PER_USER; i += 1) {
          await repo.create(USER_A, savedData(`주소 ${i}`));
        }

        await expect(repo.create(USER_A, savedData("넘치는 주소"))).rejects.toThrow(SavedLimitExceededError);
        // 상한은 사용자별이다.
        await expect(repo.create(USER_B, savedData("다른 사용자 주소"))).resolves.toHaveProperty("id");
      });
    });

    describe("listByUser", () => {
      it("요약(주소·신호 수·기준일·저장일)을 최신순으로 돌려준다", async () => {
        const first = await repo.create(USER_A, savedData("첫째 주소", 0));
        const second = await repo.create(USER_A, savedData("둘째 주소", 3));

        const { items, nextCursor } = await repo.listByUser(USER_A, { limit: 10 });

        expect(items).toEqual([
          {
            id: second.id,
            addressDisplay: "둘째 주소",
            signalCount: 3,
            dataBaseDate,
            createdAt: new Date(Date.UTC(2026, 8, 1, 0, 1, 0)),
          },
          {
            id: first.id,
            addressDisplay: "첫째 주소",
            signalCount: 0,
            dataBaseDate,
            createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, 0)),
          },
        ]);
        expect(nextCursor).toBeNull();
      });

      it("다른 사용자의 결과는 목록에 없다", async () => {
        await repo.create(USER_B, savedData("B의 주소"));
        const mine = await repo.create(USER_A, savedData("A의 주소"));

        const { items } = await repo.listByUser(USER_A, { limit: 10 });

        expect(items.map((item) => item.id)).toEqual([mine.id]);
      });

      it("limit만큼 자르고 커서로 다음 페이지를 이어서 준다", async () => {
        const ids: string[] = [];
        for (let i = 0; i < 5; i += 1) ids.push((await repo.create(USER_A, savedData(`주소 ${i}`))).id);
        const newestFirst = [...ids].reverse();

        const page1 = await repo.listByUser(USER_A, { limit: 2 });
        expect(page1.items.map((item) => item.id)).toEqual(newestFirst.slice(0, 2));
        expect(page1.nextCursor).not.toBeNull();

        const page2 = await repo.listByUser(USER_A, { cursor: page1.nextCursor!, limit: 2 });
        expect(page2.items.map((item) => item.id)).toEqual(newestFirst.slice(2, 4));
        expect(page2.nextCursor).not.toBeNull();

        const page3 = await repo.listByUser(USER_A, { cursor: page2.nextCursor!, limit: 2 });
        expect(page3.items.map((item) => item.id)).toEqual(newestFirst.slice(4));
        expect(page3.nextCursor).toBeNull();
      });

      it("마지막 페이지가 limit과 딱 맞으면 nextCursor가 null이다", async () => {
        await repo.create(USER_A, savedData("주소 1"));
        await repo.create(USER_A, savedData("주소 2"));

        expect((await repo.listByUser(USER_A, { limit: 2 })).nextCursor).toBeNull();
      });

      it("다른 사용자의 id나 없는 id를 커서로 주면 빈 목록이다", async () => {
        const others = await repo.create(USER_B, savedData("B의 주소"));
        await repo.create(USER_A, savedData("A의 주소"));

        expect(await repo.listByUser(USER_A, { cursor: others.id, limit: 10 })).toEqual({ items: [], nextCursor: null });
        expect(await repo.listByUser(USER_A, { cursor: "no-such-id", limit: 10 })).toEqual({
          items: [],
          nextCursor: null,
        });
      });

      it("limit이 1보다 작거나 정수가 아니면 RangeError", async () => {
        await expect(repo.listByUser(USER_A, { limit: 0 })).rejects.toThrow(RangeError);
        await expect(repo.listByUser(USER_A, { limit: 1.5 })).rejects.toThrow(RangeError);
      });
    });

    describe("createdAt이 같을 때", () => {
      beforeEach(async () => {
        repo = await makeRepo(makeFrozenClock());
      });

      it("커서로 넘겨도 빠지거나 겹치는 항목이 없다", async () => {
        const ids: string[] = [];
        for (let i = 0; i < 5; i += 1) ids.push((await repo.create(USER_A, savedData(`주소 ${i}`))).id);

        const seen: string[] = [];
        let cursor: string | undefined;
        do {
          const page = await repo.listByUser(USER_A, { cursor, limit: 2 });
          seen.push(...page.items.map((item) => item.id));
          cursor = page.nextCursor ?? undefined;
        } while (cursor);

        expect(seen).toHaveLength(5);
        expect([...seen].sort()).toEqual([...ids].sort());
      });
    });

    describe("deleteForUser", () => {
      it("삭제하면 true이고 이후 조회는 null이다", async () => {
        const { id } = await repo.create(USER_A, savedData("서울 마포구 망원동 412-7"));

        expect(await repo.deleteForUser(USER_A, id)).toBe(true);
        expect(await repo.getForUser(USER_A, id)).toBeNull();
        expect((await repo.listByUser(USER_A, { limit: 10 })).items).toEqual([]);
      });

      it("다른 사용자의 결과는 지우지 못하고 false다", async () => {
        const { id } = await repo.create(USER_A, savedData("서울 마포구 망원동 412-7"));

        expect(await repo.deleteForUser(USER_B, id)).toBe(false);
        expect(await repo.getForUser(USER_A, id)).not.toBeNull();
      });

      it("없는 id나 이미 지운 id는 false다", async () => {
        const { id } = await repo.create(USER_A, savedData("서울 마포구 망원동 412-7"));
        await repo.deleteForUser(USER_A, id);

        expect(await repo.deleteForUser(USER_A, id)).toBe(false);
        expect(await repo.deleteForUser(USER_A, "no-such-id")).toBe(false);
      });
    });
  });
}
