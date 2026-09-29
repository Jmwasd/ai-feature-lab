import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemorySavedResultRepository } from "@/server/saved/memory-repository";
import type { SavedResultRepository } from "@/server/saved/repository";

const { auth, redirect, revalidatePath, repoRef } = vi.hoisted(() => ({
  auth: vi.fn(),
  // 실제 redirect처럼 이후 코드가 실행되지 않게 던진다.
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
  revalidatePath: vi.fn(),
  repoRef: { current: null as SavedResultRepository | null },
}));
vi.mock("@/server/auth", () => ({ auth }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath }));
// Prisma 대신 같은 계약을 지키는 in-memory 저장소를 쓴다.
vi.mock("@/server/saved/prisma-repository", () => ({ createPrismaSavedResultRepository: () => repoRef.current }));

import { OTHER_USER_ID, SESSION, saveView } from "../__fixtures__/saved";
import { deleteResultAction } from "./delete-result";

const USER_ID = SESSION.user.id;
let repo: SavedResultRepository;

beforeEach(() => {
  auth.mockReset().mockResolvedValue(SESSION);
  redirect.mockClear();
  revalidatePath.mockClear();
  repo = createMemorySavedResultRepository();
  repoRef.current = repo;
});

describe("deleteResultAction", () => {
  it("세션이 없으면 unauthorized이고 지우지 않는다", async () => {
    const { id } = await saveView(repo, USER_ID);
    auth.mockResolvedValue(null);

    expect(await deleteResultAction(id)).toEqual({ ok: false, error: "unauthorized" });
    expect(await repo.getForUser(USER_ID, id)).not.toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("다른 사용자의 결과는 지우지 않고 없는 id와 같은 not-found를 돌려준다", async () => {
    const { id } = await saveView(repo, OTHER_USER_ID);

    expect(await deleteResultAction(id)).toEqual({ ok: false, error: "not-found" });
    expect(await deleteResultAction("missing")).toEqual({ ok: false, error: "not-found" });
    expect(await repo.getForUser(OTHER_USER_ID, id)).not.toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([undefined, 1, "", { id: "x" }])("id가 %s이면 not-found", async (id) => {
    expect(await deleteResultAction(id)).toEqual({ ok: false, error: "not-found" });
  });

  it("자기 결과는 지우고 목록으로 이동한다", async () => {
    const { id } = await saveView(repo, USER_ID);

    await expect(deleteResultAction(id)).rejects.toThrow("NEXT_REDIRECT /saved");
    expect(await repo.getForUser(USER_ID, id)).toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith("/saved");
    expect(redirect).toHaveBeenCalledWith("/saved");
  });

  it("저장소 오류는 failed로 바꾸고 메시지를 싣지 않는다", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    repo.deleteForUser = vi.fn().mockRejectedValue(new Error("connection refused postgres://user:SECRET@db"));

    const result = await deleteResultAction("s1");

    expect(result).toEqual({ ok: false, error: "failed" });
    expect(JSON.stringify(result)).not.toContain("SECRET");
    consoleError.mockRestore();
  });
});
