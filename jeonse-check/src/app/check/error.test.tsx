import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import { ROUTE_ERROR_COPY } from "./_components/error-copy";
import CheckRouteError from "./error";

const SECRET = "fetch failed: https://apis.data.go.kr/x?serviceKey=SECRET123";

function renderError(retry = vi.fn()) {
  const error = Object.assign(new Error(SECRET), { digest: "abc123" });
  error.stack = `Error: ${SECRET}\n    at collect (src/server/lookup/collect-inputs.ts:1:1)`;
  render(<CheckRouteError error={error} retry={retry} reset={vi.fn()} />);
  return retry;
}

describe("/check 오류 경계", () => {
  it("일반 안내와 '다시 시도'를 보여 주고, 누르면 retry를 한 번 부른다", async () => {
    const user = userEvent.setup();
    const retry = renderError();

    expect(screen.getByRole("heading", { name: ROUTE_ERROR_COPY.title })).toBeInTheDocument();
    expect(screen.getByText(ROUTE_ERROR_COPY.description)).toBeInTheDocument();
    // 자동 재시도하지 않는다
    expect(retry).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: ROUTE_ERROR_COPY.action }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("오류 메시지·스택·digest를 화면에 내보내지 않는다", () => {
    renderError();
    const text = document.body.textContent ?? "";

    expect(text).not.toContain("SECRET123");
    expect(text).not.toContain("serviceKey");
    expect(text).not.toContain("collect-inputs");
    expect(text).not.toContain("abc123");
  });

  it("금지 표현과 '위험 신호' 문구가 없다", () => {
    renderError();
    const text = document.body.textContent ?? "";

    expectNoForbiddenPhrases(text);
    expect(text).not.toContain("위험 신호");
  });
});
