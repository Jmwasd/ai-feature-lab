import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIDENCE_LABEL, DISCLAIMER, ESTIMATE_METHOD_LABEL, SOURCES } from "@/features/judgment/copy";
import { serializeJudgmentView } from "@/features/judgment/serialize";
import { FIXTURE_DATA_BASE_DATE } from "@/features/judgment/ui/__fixtures__/views";
import { createMemorySavedResultRepository } from "@/server/saved/memory-repository";
import type { SavedResultRepository } from "@/server/saved/repository";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";

const { auth, redirect, notFound, repoRef } = vi.hoisted(() => ({
  auth: vi.fn(),
  // 실제 redirect·notFound처럼 이후 코드가 실행되지 않게 던진다.
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  repoRef: { current: null as SavedResultRepository | null },
}));
vi.mock("@/server/auth", () => ({ auth, signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/features/auth/AuthTopNav", () => ({ AuthTopNav: () => <span>auth-top-nav</span> }));
vi.mock("@/server/saved/prisma-repository", () => ({ createPrismaSavedResultRepository: () => repoRef.current }));
vi.mock("../_actions/delete-result", () => ({ deleteResultAction: vi.fn() }));

import { allSignalsView, OTHER_USER_ID, SESSION, saveView, savedInput } from "../__fixtures__/saved";
import SavedDetailPage from "./page";

const USER_ID = SESSION.user.id;
let repo: SavedResultRepository;

function props(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  auth.mockReset().mockResolvedValue(SESSION);
  redirect.mockClear();
  notFound.mockClear();
  // 한국 시간 2026-09-30 01:00에 저장
  repo = createMemorySavedResultRepository(() => new Date("2026-09-29T16:00:00Z"));
  repoRef.current = repo;
});

describe("/saved/[id] 상세", () => {
  it("세션이 없으면 로그인으로 redirect하고 저장소를 조회하지 않는다", async () => {
    const { id } = await saveView(repo, USER_ID);
    const getForUser = vi.spyOn(repo, "getForUser");
    auth.mockResolvedValue(null);

    await expect(SavedDetailPage(props(id))).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(`/?callbackUrl=/saved/${id}`);
    expect(getForUser).not.toHaveBeenCalled();
  });

  it("다른 사용자의 id는 없는 id와 똑같이 notFound", async () => {
    const { id } = await saveView(repo, OTHER_USER_ID);

    await expect(SavedDetailPage(props(id))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(SavedDetailPage(props("missing"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(2);
  });

  it("저장한 결과를 필수 요소 5개와 함께 보여 준다", async () => {
    const { id } = await saveView(repo, USER_ID, allSignalsView);
    render(await SavedDetailPage(props(id)));
    const { report, priceEstimate } = allSignalsView;

    // 1. 요약
    expect(screen.getByTestId("signal-count")).toHaveTextContent(String(report.signalCount));
    expect(screen.getByRole("heading", { name: report.headline })).toBeInTheDocument();
    // 2. 신호 목록
    expect(within(screen.getByTestId("signal-list")).getAllByTestId("signal-row")).toHaveLength(report.signals.length);
    // 3. 시세 추정 근거
    const evidence = screen.getByTestId("price-evidence");
    expect(evidence).toHaveTextContent(ESTIMATE_METHOD_LABEL[priceEstimate.method]);
    expect(evidence).toHaveTextContent(CONFIDENCE_LABEL[priceEstimate.confidence]);
    expect(within(evidence).queryAllByTestId("comparable-row")).toHaveLength(priceEstimate.comparables.length);
    // 4. 데이터 기준일과 출처
    const footer = screen.getByTestId("report-footer");
    expect(footer).toHaveTextContent("데이터 기준일 2026-09-01");
    for (const source of SOURCES) expect(footer).toHaveTextContent(source);
    // 5. 면책 문구
    expect(screen.getByText(DISCLAIMER)).toBeVisible();
  });

  it("저장일·기준일 안내와 같은 조건으로 다시 조회하는 링크를 보여 준다", async () => {
    const { id } = await saveView(repo, USER_ID);
    render(await SavedDetailPage(props(id)));

    expect(
      screen.getByText("2026-09-30에 저장한 결과예요. 데이터 기준일은 2026-09-01이에요. 지금 다시 조회하면 달라질 수 있어요"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "같은 조건으로 다시 조회" })).toHaveAttribute("href", `/check?from=${id}`);
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  it("모르는 version이면 결과 대신 안내를 보이고 변환하지 않는다", async () => {
    const { id } = await repo.create(USER_ID, {
      input: savedInput(allSignalsView),
      result: { ...serializeJudgmentView(allSignalsView), version: 999 },
      dataBaseDate: FIXTURE_DATA_BASE_DATE,
    });
    render(await SavedDetailPage(props(id)));

    expect(screen.getByText("이전 형식의 결과라 표시할 수 없어요")).toBeInTheDocument();
    expect(screen.queryByTestId("signal-count")).not.toBeInTheDocument();
    expect(screen.queryByTestId("signal-list")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "같은 조건으로 다시 조회" })).toBeInTheDocument();
  });

  it("렌더링 텍스트에 금지 표현이 없다", async () => {
    const { id } = await saveView(repo, USER_ID, allSignalsView);
    const { container } = render(await SavedDetailPage(props(id)));

    expectNoForbiddenPhrases(container.textContent ?? "");
  });
});
