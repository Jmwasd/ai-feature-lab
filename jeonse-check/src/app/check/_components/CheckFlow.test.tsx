import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DISCLAIMER, SOURCES } from "@/features/judgment/copy";
import { serializeJudgmentView } from "@/features/judgment/serialize";
import { noSignalsView } from "@/features/judgment/ui/__fixtures__/views";
import type { AddressCandidate } from "@/features/lookup-input/schema";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import { wonToInputText } from "@/utils/parse-won-input";
import type { RunCheckResult } from "../_actions/run-check";
import type { SearchAddressResult } from "../_actions/search-address";
import { CheckFlow } from "./CheckFlow";

const candidate: AddressCandidate = {
  id: "a1",
  roadAddress: "서울특별시 마포구 월드컵로 100",
  jibunAddress: "서울특별시 마포구 망원동 100",
  buildingName: "망원빌라",
  admCd: "1144012300",
};

const okView = serializeJudgmentView(noSignalsView);
const okResult: RunCheckResult = { ok: true, view: okView };

type User = ReturnType<typeof userEvent.setup>;

function setup(runCheck = vi.fn(async (): Promise<RunCheckResult> => okResult)) {
  const searchAddress = vi.fn(async (): Promise<SearchAddressResult> => ({ ok: true, candidates: [candidate] }));
  const user = userEvent.setup();
  render(<CheckFlow searchAddress={searchAddress} runCheck={runCheck} />);
  return { user, searchAddress, runCheck };
}

async function fillLookup(user: User) {
  await user.click(screen.getByRole("radio", { name: "연립다세대" }));
  await user.type(screen.getByLabelText("주소"), "월드컵로");
  await user.click(screen.getByRole("button", { name: "주소 검색" }));
  await user.click(await screen.findByRole("button", { name: /월드컵로 100/ }));
  await user.type(screen.getByLabelText("보증금"), "1억 5000만");
  await user.type(screen.getByLabelText("전용면적(㎡)"), "59");
  await user.click(screen.getAllByRole("button", { name: "조회하기" })[0]);
}

async function fillRights(user: User) {
  await user.click(screen.getByRole("radio", { name: "근저당 없음" }));
  await user.type(screen.getByLabelText("선순위 임차보증금 합계"), "0");
  await user.click(screen.getByRole("radio", { name: "아니오" }));
  await user.click(screen.getByRole("checkbox", { name: /소유권 이전 없음/ }));
  await user.click(screen.getByRole("button", { name: "위험 신호 확인하기" }));
}

function currentStep() {
  const current = within(screen.getByRole("list", { name: "진행 단계" }))
    .getAllByRole("listitem")
    .find((item) => item.getAttribute("aria-current") === "step");
  return current?.textContent ?? "";
}

describe("CheckFlow", () => {
  it("조회 조건 → 권리 입력 → 결과 순서로 넘어가고 진행 표시가 따라간다", async () => {
    const { user, searchAddress, runCheck } = setup();

    expect(currentStep()).toContain("조회 조건");
    await fillLookup(user);
    expect(searchAddress).toHaveBeenCalledWith("월드컵로");

    expect(currentStep()).toContain("권리관계");
    expect(screen.getByRole("form", { name: "권리관계 입력" })).toBeInTheDocument();

    await fillRights(user);
    expect(await screen.findByTestId("signal-count")).toBeInTheDocument();
    expect(currentStep()).toContain("결과");

    expect(runCheck).toHaveBeenCalledTimes(1);
    expect(runCheck).toHaveBeenCalledWith({
      lookup: expect.objectContaining({ address: candidate, houseType: "row-house", deposit: 150_000_000, exclusiveArea: 59 }),
      rights: { maxClaimAmount: 0, seniorDeposits: 0, isTrust: false, lastOwnershipChangeDate: null },
    });
  });

  it("권리 입력에서 이전으로 돌아가면 조회 조건 입력이 남아 있다", async () => {
    const { user } = setup();
    await fillLookup(user);

    await user.click(screen.getByRole("button", { name: "이전" }));

    expect(currentStep()).toContain("조회 조건");
    expect(screen.getByLabelText("주소")).toHaveValue(candidate.roadAddress);
    expect(screen.getByLabelText("보증금")).toHaveValue(wonToInputText(150_000_000));
    expect(screen.getByLabelText("전용면적(㎡)")).toHaveValue("59");
    expect(screen.getByRole("radio", { name: "연립다세대" })).toBeChecked();
  });

  it("판정을 기다리는 동안 대기 화면을 보여 준다", async () => {
    let resolve!: (result: RunCheckResult) => void;
    const runCheck = vi.fn(() => new Promise<RunCheckResult>((r) => (resolve = r)));
    const { user } = setup(runCheck);
    await fillLookup(user);
    await fillRights(user);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("실거래가를 모으고 있어요");
    expect(status).toHaveTextContent(/첫 조회/);
    expect(screen.queryByTestId("signal-count")).not.toBeInTheDocument();

    resolve(okResult);
    expect(await screen.findByTestId("signal-count")).toBeInTheDocument();
    expect(screen.queryByText("실거래가를 모으고 있어요")).not.toBeInTheDocument();
  });

  it("결과 화면에 필수 요소 5개가 모두 있고 금지 표현이 없다", async () => {
    const { user } = setup();
    await fillLookup(user);
    await fillRights(user);

    // 1. 요약
    expect(await screen.findByTestId("signal-count")).toHaveTextContent(String(noSignalsView.report.signalCount));
    expect(screen.getByRole("heading", { name: noSignalsView.report.headline })).toBeInTheDocument();
    // 2. 신호 목록
    expect(screen.getByTestId("signal-list")).toBeInTheDocument();
    // 3. 시세 추정 근거
    expect(screen.getByTestId("price-evidence")).toBeInTheDocument();
    expect(screen.getByTestId("comparables")).toBeInTheDocument();
    // 4. 데이터 기준일과 출처
    const footer = screen.getByTestId("report-footer");
    expect(within(footer).getByText(/데이터 기준일/)).toBeInTheDocument();
    for (const source of SOURCES) expect(footer).toHaveTextContent(source);
    // 5. 면책 문구
    expect(screen.getByText(DISCLAIMER)).toBeVisible();

    expectNoForbiddenPhrases(document.body.textContent ?? "");
  });

  it("'조건 바꿔 다시 보기'를 누르면 입력을 유지한 채 조회 조건으로 돌아간다", async () => {
    const { user } = setup();
    await fillLookup(user);
    await fillRights(user);
    await screen.findByTestId("signal-count");

    await user.click(screen.getByRole("button", { name: "조건 바꿔 다시 보기" }));

    expect(currentStep()).toContain("조회 조건");
    expect(screen.queryByTestId("signal-count")).not.toBeInTheDocument();
    expect(screen.getByLabelText("보증금")).toHaveValue(wonToInputText(150_000_000));
  });

  it("오류 코드가 오면 '다시 시도'를 보여 주고, 누르면 같은 입력으로 다시 판정한다", async () => {
    const runCheck = vi
      .fn<() => Promise<RunCheckResult>>()
      .mockResolvedValueOnce({ ok: false, error: "lookup-failed" })
      .mockResolvedValueOnce(okResult);
    const { user } = setup(runCheck);
    await fillLookup(user);
    await fillRights(user);

    const retry = await screen.findByRole("button", { name: "다시 시도" });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByTestId("signal-count")).not.toBeInTheDocument();

    await user.click(retry);

    expect(await screen.findByTestId("signal-count")).toBeInTheDocument();
    expect(runCheck).toHaveBeenCalledTimes(2);
    expect(runCheck.mock.calls[1]).toEqual(runCheck.mock.calls[0]);
  });

  it("결과 형식을 읽지 못해도 '다시 시도'로 처리한다", async () => {
    const broken = { ok: true, view: { ...okView, version: 99 } } as unknown as RunCheckResult;
    const { user } = setup(vi.fn(async () => broken));
    await fillLookup(user);
    await fillRights(user);

    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("주소 검색이 실패 코드를 돌려주면 검색 오류 안내를 보여 준다", async () => {
    const user = userEvent.setup();
    const searchAddress = vi.fn(async (): Promise<SearchAddressResult> => ({ ok: false, error: "unavailable" }));
    render(<CheckFlow searchAddress={searchAddress} runCheck={vi.fn()} />);

    await user.type(screen.getByLabelText("주소"), "월드컵로");
    await user.click(screen.getByRole("button", { name: "주소 검색" }));

    expect(await screen.findByText(/주소를 불러오지 못했어요/)).toBeInTheDocument();
  });
});
