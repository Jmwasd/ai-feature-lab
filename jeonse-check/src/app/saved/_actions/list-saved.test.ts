import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemorySavedResultRepository } from "@/server/saved/memory-repository";
import type { SavedResultRepository } from "@/server/saved/repository";

const { auth, repoRef } = vi.hoisted(() => ({
  auth: vi.fn(),
  repoRef: { current: null as SavedResultRepository | null },
}));
vi.mock("@/server/auth", () => ({ auth }));
vi.mock("@/server/saved/prisma-repository", () => ({ createPrismaSavedResultRepository: () => repoRef.current }));

import { OTHER_USER_ID, SESSION, saveView } from "../__fixtures__/saved";
import { SAVED_PAGE_SIZE } from "../_lib/saved-list";
import { loadMoreSavedAction } from "./list-saved";

const USER_ID = SESSION.user.id;
let repo: SavedResultRepository;

beforeEach(() => {
  auth.mockReset().mockResolvedValue(SESSION);
  let tick = 0;
  // 저장 순서대로 1초씩 늦게 저장한 것으로 둔다.
  repo = createMemorySavedResultRepository(() => new Date(Date.UTC(2026, 8, 29, 0, 0, tick++)));
  repoRef.current = repo;
});

describe("loadMoreSavedAction", () => {
  it("세션이 없으면 unauthorized", async () => {
    auth.mockResolvedValue(null);

    expect(await loadMoreSavedAction("x")).toEqual({ ok: false, error: "unauthorized" });
  });

  it("커서 다음 페이지를 자기 결과로만 돌려준다", async () => {
    for (let i = 0; i < SAVED_PAGE_SIZE + 2; i += 1) await saveView(repo, USER_ID);
    await saveView(repo, OTHER_USER_ID);
    const first = await repo.listByUser(USER_ID, { limit: SAVED_PAGE_SIZE });

    const result = await loadMoreSavedAction(first.nextCursor);

    if (!result.ok) throw new Error(result.error);
    expect(result.page.items).toHaveLength(2);
    expect(result.page.nextCursor).toBeNull();
    expect(result.page.items[0]).toEqual({
      id: expect.any(String),
      addressDisplay: expect.any(String),
      headline: "위험 신호 0개",
      dataBaseDate: "2026-09-01",
      savedAt: "2026-09-29",
    });
  });

  it("다른 사용자의 id를 커서로 주면 빈 페이지", async () => {
    const { id } = await saveView(repo, OTHER_USER_ID);

    expect(await loadMoreSavedAction(id)).toEqual({ ok: true, page: { items: [], nextCursor: null } });
  });

  it.each([undefined, "", 3])("커서가 %s이면 failed", async (cursor) => {
    expect(await loadMoreSavedAction(cursor)).toEqual({ ok: false, error: "failed" });
  });
});
