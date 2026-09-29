import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import type { CheckError as CheckErrorCode } from "../_actions/run-check";
import { CheckError } from "./CheckError";
import { CHECK_ERROR_COPY, ROUTE_ERROR_COPY } from "./error-copy";

const CODES = Object.keys(CHECK_ERROR_COPY) as CheckErrorCode[];

const EXPECTED_ACTION: Record<CheckErrorCode, string> = {
  "invalid-input": "입력 다시 확인하기",
  "address-not-found": "주소 다시 검색하기",
  "unsupported-house": "처음으로",
  quota: "다시 시도",
  "lookup-failed": "다시 시도",
  unauthorized: "다시 로그인하기",
};

describe("CheckError", () => {
  it("CheckError 코드 6개에 모두 문구가 있다", () => {
    expect(CODES.sort()).toEqual(Object.keys(EXPECTED_ACTION).sort());
  });

  it.each(CODES.filter((code) => code !== "unauthorized"))("%s — 제목·설명·행동 버튼을 보여 주고 누르면 onAction을 부른다", async (code) => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<CheckError code={code} onAction={onAction} />);
    const copy = CHECK_ERROR_COPY[code];

    expect(screen.getByRole("alert")).toHaveTextContent(copy.title);
    expect(screen.getByRole("heading", { name: copy.title })).toBeInTheDocument();
    expect(screen.getByText(copy.description)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: EXPECTED_ACTION[code] }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("unauthorized — 로그인 뒤 /check로 돌아오는 링크를 보여 준다", () => {
    render(<CheckError code="unauthorized" onAction={vi.fn()} />);

    expect(screen.getByRole("heading", { name: CHECK_ERROR_COPY.unauthorized.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: EXPECTED_ACTION.unauthorized })).toHaveAttribute("href", "/?callbackUrl=/check");
  });

  it("unsupported-house는 MVP 지원 유형(아파트·연립다세대)을 알려 준다", () => {
    expect(CHECK_ERROR_COPY["unsupported-house"].description).toMatch(/아파트/);
    expect(CHECK_ERROR_COPY["unsupported-house"].description).toMatch(/연립다세대/);
  });

  it.each(CODES)("%s — 금지 표현과 '위험 신호' 문구가 없다", (code) => {
    render(<CheckError code={code} onAction={vi.fn()} />);
    const text = document.body.textContent ?? "";

    expectNoForbiddenPhrases(text);
    expect(text).not.toContain("위험 신호");
    expect(screen.queryByTestId("signal-count")).not.toBeInTheDocument();
  });

  it("라우트 오류 경계 문구에도 금지 표현이 없다", () => {
    for (const text of Object.values(ROUTE_ERROR_COPY)) expectNoForbiddenPhrases(text);
  });
});
