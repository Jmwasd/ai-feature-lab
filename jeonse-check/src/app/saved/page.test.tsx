import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DISCLAIMER, SOURCES } from "@/features/judgment/copy";
import { createMemorySavedResultRepository } from "@/server/saved/memory-repository";
import type { SavedResultRepository } from "@/server/saved/repository";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";

const { auth, redirect, repoRef } = vi.hoisted(() => ({
  auth: vi.fn(),
  // 실제 redirect처럼 이후 코드가 실행되지 않게 던진다.
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
  repoRef: { current: null as SavedResultRepository | null },
}));
vi.mock("@/server/auth", () => ({ auth, signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
// 비동기 Server Component는 jsdom에서 렌더링할 수 없어 자리 표시로 바꾼다. 자체 동작은 AuthTopNav.test.tsx가 검증한다.
vi.mock("@/features/auth/AuthTopNav", () => ({ AuthTopNav: () => <span>auth-top-nav</span> }));
vi.mock("@/server/saved/prisma-repository", () => ({ createPrismaSavedResultRepository: () => repoRef.current }));
vi.mock("./_actions/list-saved", () => ({ loadMoreSavedAction: vi.fn() }));

import { allSignalsView, noSignalsView, OTHER_USER_ID, SESSION, saveView } from "./__fixtures__/saved";
import { SAVED_PAGE_SIZE } from "./_lib/saved-list";
import SavedPage from "./page";

const USER_ID = SESSION.user.id;
let repo: SavedResultRepository;

beforeEach(() => {
  auth.mockReset().mockResolvedValue(SESSION);
  redirect.mockClear();
  let tick = 0;
  // 저장 순서대로 1초씩 늦게 저장한 것으로 둔다. 한국 시간으로는 2026-09-30이다.
  repo = createMemorySavedResultRepository(() => new Date(Date.UTC(2026, 8, 29, 16, 0, tick++)));
  repoRef.current = repo;
});

describe("/saved 목록", () => {
  it("세션이 없으면 /?callbackUrl=/saved로 redirect한다", async () => {
    auth.mockResolvedValue(null);

    await expect(SavedPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/?callbackUrl=/saved");
  });

  it("비었으면 안내와 /check로 가는 버튼을 보여 준다", async () => {
    await saveView(repo, OTHER_USER_ID);
    render(await SavedPage());

    expect(screen.getByText("저장한 결과가 없어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "조회하러 가기" })).toHaveAttribute("href", "/check");
    expect(screen.queryByRole("list", { name: "저장한 결과" })).not.toBeInTheDocument();
  });

  it("항목마다 주소·'위험 신호 N개'·데이터 기준일·저장일을 최신순으로 보여 주고 상세로 연결한다", async () => {
    const older = await saveView(repo, USER_ID, noSignalsView);
    const newer = await saveView(repo, USER_ID, allSignalsView);
    await saveView(repo, OTHER_USER_ID);
    render(await SavedPage());

    const rows = within(screen.getByRole("list", { name: "저장한 결과" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole("link")).toHaveAttribute("href", `/saved/${newer.id}`);
    expect(within(rows[1]).getByRole("link")).toHaveAttribute("href", `/saved/${older.id}`);
    expect(rows[0]).toHaveTextContent(allSignalsView.address.display);
    expect(rows[0]).toHaveTextContent(allSignalsView.report.headline);
    expect(rows[1]).toHaveTextContent("위험 신호 0개");
    expect(rows[0]).toHaveTextContent("데이터 기준일 2026-09-01");
    expect(rows[0]).toHaveTextContent("저장일 2026-09-30");
  });

  it("다음 페이지가 있으면 '더 보기'를 보여 준다", async () => {
    for (let i = 0; i < SAVED_PAGE_SIZE + 1; i += 1) await saveView(repo, USER_ID);
    render(await SavedPage());

    expect(within(screen.getByRole("list", { name: "저장한 결과" })).getAllByRole("listitem")).toHaveLength(SAVED_PAGE_SIZE);
    expect(screen.getByRole("button", { name: "더 보기" })).toBeInTheDocument();
  });

  it("면책 문구와 출처를 함께 보여 주고 금지 표현이 없다", async () => {
    await saveView(repo, USER_ID, allSignalsView);
    const { container } = render(await SavedPage());

    expect(screen.getByText(DISCLAIMER)).toHaveClass("text-body-sm", "text-body");
    for (const source of SOURCES) expect(container).toHaveTextContent(source);
    expectNoForbiddenPhrases(container.textContent ?? "");
  });
});
