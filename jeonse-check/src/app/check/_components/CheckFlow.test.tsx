import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DISCLAIMER, SOURCES } from "@/features/judgment/copy";
import { serializeJudgmentView } from "@/features/judgment/serialize";
import { noSignalsView } from "@/features/judgment/ui/__fixtures__/views";
import type { AddressCandidate } from "@/features/lookup-input/schema";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import { wonToInputText } from "@/utils/parse-won-input";
import type { CheckError as CheckErrorCode, RunCheckResult } from "../_actions/run-check";
import type { SaveResultError, SaveResultResult } from "../_actions/save-result";
import type { SearchAddressResult } from "../_actions/search-address";
import { CheckFlow } from "./CheckFlow";
import { CHECK_ERROR_COPY } from "./error-copy";
import { SAVE_ERROR_COPY } from "./SaveResultButton";

const candidate: AddressCandidate = {
  id: "a1",
  roadAddress: "서울특별시 마포구 월드컵로 100",
  jibunAddress: "서울특별시 마포구 망원동 100",
  buildingName: "망원빌라",
  admCd: "1144012300",
};

const okView = serializeJudgmentView(noSignalsView);
const okResult: RunCheckResult = { ok: true, view: okView, saveToken: "token-1" };

type User = ReturnType<typeof userEvent.setup>;

function setup(
  runCheck = vi.fn(async (): Promise<RunCheckResult> => okResult),
  saveResult = vi.fn(async (): Promise<SaveResultResult> => ({ ok: true, id: "saved-1" })),
) {
  const searchAddress = vi.fn(async (): Promise<SearchAddressResult> => ({ ok: true, candidates: [candidate] }));
  const user = userEvent.setup();
  render(<CheckFlow searchAddress={searchAddress} runCheck={runCheck} saveResult={saveResult} />);
  return { user, searchAddress, runCheck, saveResult };
}

async function reachResult(user: User) {
  await fillLookup(user);
  await fillRights(user);
  await screen.findByTestId("signal-count");
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

  it("판정 호출이 예외를 던지면 공공데이터 실패 안내와 '다시 시도'를 보여 준다", async () => {
    const { user } = setup(vi.fn(async (): Promise<RunCheckResult> => {
      throw new Error("fetch failed: https://apis.data.go.kr/x?serviceKey=SECRET123");
    }));
    await fillLookup(user);
    await fillRights(user);

    expect(await screen.findByRole("heading", { name: CHECK_ERROR_COPY["lookup-failed"].title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("SECRET123");
  });

  it.each(Object.keys(CHECK_ERROR_COPY) as CheckErrorCode[])(
    "%s — 코드별 안내를 보여 주고 '위험 신호' 헤드라인·개수를 보여 주지 않는다",
    async (code) => {
      const { user } = setup(vi.fn(async (): Promise<RunCheckResult> => ({ ok: false, error: code })));
      await fillLookup(user);
      await fillRights(user);

      expect(await screen.findByRole("heading", { name: CHECK_ERROR_COPY[code].title })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /위험 신호/ })).not.toBeInTheDocument();
      expect(screen.queryByTestId("signal-count")).not.toBeInTheDocument();
      expectNoForbiddenPhrases(document.body.textContent ?? "");
    },
  );

  it("invalid-input — 권리관계 단계로 돌아가고 입력이 남아 있다", async () => {
    const { user, runCheck } = setup(vi.fn(async (): Promise<RunCheckResult> => ({ ok: false, error: "invalid-input" })));
    await fillLookup(user);
    await fillRights(user);

    await user.click(await screen.findByRole("button", { name: "입력 다시 확인하기" }));

    expect(currentStep()).toContain("권리관계");
    expect(screen.getByLabelText("선순위 임차보증금 합계")).toHaveValue(wonToInputText(0));
    expect(screen.getByRole("radio", { name: "아니오" })).toBeChecked();
    expect(runCheck).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "이전" }));
    expect(screen.getByLabelText("보증금")).toHaveValue(wonToInputText(150_000_000));
  });

  it("address-not-found — 조회 조건 단계로 돌아가 주소를 다시 검색하게 하고 다른 입력은 남긴다", async () => {
    const { user, runCheck } = setup(vi.fn(async (): Promise<RunCheckResult> => ({ ok: false, error: "address-not-found" })));
    await fillLookup(user);
    await fillRights(user);

    await user.click(await screen.findByRole("button", { name: "주소 다시 검색하기" }));

    expect(currentStep()).toContain("조회 조건");
    expect(screen.getByLabelText("보증금")).toHaveValue(wonToInputText(150_000_000));
    expect(runCheck).toHaveBeenCalledTimes(1);
  });

  it("unsupported-house — 입력을 비우고 처음으로 돌아간다", async () => {
    const { user } = setup(vi.fn(async (): Promise<RunCheckResult> => ({ ok: false, error: "unsupported-house" })));
    await fillLookup(user);
    await fillRights(user);

    await user.click(await screen.findByRole("button", { name: "처음으로" }));

    expect(currentStep()).toContain("조회 조건");
    expect(screen.getByLabelText("보증금")).toHaveValue("");
    expect(screen.getByLabelText("주소")).toHaveValue("");
  });

  it("quota — 자동으로 다시 부르지 않고, '다시 시도'를 눌렀을 때만 같은 입력으로 다시 판정한다", async () => {
    const runCheck = vi
      .fn<() => Promise<RunCheckResult>>()
      .mockResolvedValueOnce({ ok: false, error: "quota" })
      .mockResolvedValueOnce(okResult);
    const { user } = setup(runCheck);
    await fillLookup(user);
    await fillRights(user);

    const retry = await screen.findByRole("button", { name: "다시 시도" });
    expect(screen.getByText(CHECK_ERROR_COPY.quota.description)).toBeInTheDocument();
    expect(runCheck).toHaveBeenCalledTimes(1);

    await user.click(retry);

    expect(await screen.findByTestId("signal-count")).toBeInTheDocument();
    expect(runCheck).toHaveBeenCalledTimes(2);
    expect(runCheck.mock.calls[1]).toEqual(runCheck.mock.calls[0]);
  });

  it("unauthorized — 로그인 링크를 보여 준다", async () => {
    const { user } = setup(vi.fn(async (): Promise<RunCheckResult> => ({ ok: false, error: "unauthorized" })));
    await fillLookup(user);
    await fillRights(user);

    expect(await screen.findByRole("link", { name: "다시 로그인하기" })).toHaveAttribute("href", "/?callbackUrl=/check");
  });

  it("주소 검색이 실패 코드를 돌려주면 검색 오류 안내를 보여 준다", async () => {
    const user = userEvent.setup();
    const searchAddress = vi.fn(async (): Promise<SearchAddressResult> => ({ ok: false, error: "unavailable" }));
    render(<CheckFlow searchAddress={searchAddress} runCheck={vi.fn()} saveResult={vi.fn()} />);

    await user.type(screen.getByLabelText("주소"), "월드컵로");
    await user.click(screen.getByRole("button", { name: "주소 검색" }));

    expect(await screen.findByText(/주소를 불러오지 못했어요/)).toBeInTheDocument();
  });

  describe("결과 저장", () => {
    it("'결과 저장'을 누르면 판정 때 받은 토큰으로 저장하고 저장 목록 링크를 보여 준다", async () => {
      const { user, saveResult } = setup();
      await reachResult(user);

      const button = screen.getByRole("button", { name: "결과 저장" });
      await user.click(button);

      expect(saveResult).toHaveBeenCalledWith({ token: "token-1" });
      const status = await screen.findByRole("status");
      expect(status).toHaveTextContent("저장했어요");
      expect(within(status).getByRole("link", { name: "저장 목록 보기" })).toHaveAttribute("href", "/saved");
      // 같은 결과를 두 번 저장하지 않는다
      expect(button).toBeDisabled();
    });

    it("저장하는 동안 버튼을 비활성화해 여러 번 눌러도 한 번만 저장한다", async () => {
      let resolve!: (result: SaveResultResult) => void;
      const saveResult = vi.fn(() => new Promise<SaveResultResult>((r) => (resolve = r)));
      const { user } = setup(undefined, saveResult);
      await reachResult(user);

      const button = screen.getByRole("button", { name: "결과 저장" });
      await user.click(button);
      expect(button).toBeDisabled();
      await user.dblClick(button);
      expect(saveResult).toHaveBeenCalledTimes(1);

      resolve({ ok: true, id: "saved-1" });
      expect(await screen.findByText(/저장했어요/)).toBeInTheDocument();
      await user.click(button);
      expect(saveResult).toHaveBeenCalledTimes(1);
    });

    it.each(Object.keys(SAVE_ERROR_COPY) as SaveResultError[])(
      "%s — 저장 실패 안내를 보여 주고 다시 누를 수 있다",
      async (code) => {
        const saveResult = vi
          .fn<() => Promise<SaveResultResult>>()
          .mockResolvedValueOnce({ ok: false, error: code })
          .mockResolvedValueOnce({ ok: true, id: "saved-1" });
        const { user } = setup(undefined, saveResult);
        await reachResult(user);

        await user.click(screen.getByRole("button", { name: "결과 저장" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(SAVE_ERROR_COPY[code]);
        expect(screen.queryByText(/저장했어요/)).not.toBeInTheDocument();
        // 결과 화면은 그대로 둔다
        expect(screen.getByTestId("signal-count")).toBeInTheDocument();
        expectNoForbiddenPhrases(document.body.textContent ?? "");

        const button = screen.getByRole("button", { name: "결과 저장" });
        expect(button).toBeEnabled();
        await user.click(button);
        expect(await screen.findByText(/저장했어요/)).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      },
    );

    it("저장 호출이 예외를 던지면 failed 안내를 보여 준다", async () => {
      const { user } = setup(undefined, vi.fn(async (): Promise<SaveResultResult> => {
        throw new Error("network down SECRET123");
      }));
      await reachResult(user);

      await user.click(screen.getByRole("button", { name: "결과 저장" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(SAVE_ERROR_COPY.failed);
      expect(document.body.textContent).not.toContain("SECRET123");
    });

    it("저장 토큰이 없으면 호출하지 않고 failed 안내를 보여 준다", async () => {
      const saveResult = vi.fn(async (): Promise<SaveResultResult> => ({ ok: true, id: "saved-1" }));
      const { user } = setup(vi.fn(async (): Promise<RunCheckResult> => ({ ...okResult, saveToken: null })), saveResult);
      await reachResult(user);

      await user.click(screen.getByRole("button", { name: "결과 저장" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(SAVE_ERROR_COPY.failed);
      expect(saveResult).not.toHaveBeenCalled();
    });

    it("조건을 바꿔 다시 조회하면 새 결과를 다시 저장할 수 있다", async () => {
      const runCheck = vi
        .fn<() => Promise<RunCheckResult>>()
        .mockResolvedValueOnce(okResult)
        .mockResolvedValueOnce({ ...okResult, saveToken: "token-2" });
      const { user, saveResult } = setup(runCheck);
      await reachResult(user);
      await user.click(screen.getByRole("button", { name: "결과 저장" }));
      await screen.findByText(/저장했어요/);

      await user.click(screen.getByRole("button", { name: "조건 바꿔 다시 보기" }));
      await user.click(screen.getAllByRole("button", { name: "조회하기" })[0]);
      await user.click(screen.getByRole("button", { name: "위험 신호 확인하기" }));
      await screen.findByTestId("signal-count");

      expect(screen.queryByText(/저장했어요/)).not.toBeInTheDocument();
      const button = screen.getByRole("button", { name: "결과 저장" });
      expect(button).toBeEnabled();
      await user.click(button);
      expect(saveResult).toHaveBeenLastCalledWith({ token: "token-2" });
    });

    it("결과 화면에 레드 CTA 버튼을 더하지 않는다", async () => {
      const { user } = setup();
      await reachResult(user);

      expect(screen.getByRole("button", { name: "결과 저장" }).className).not.toContain("bg-primary");
    });
  });
});
