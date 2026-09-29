import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DeleteResultResult } from "../../_actions/delete-result";
import { DeleteResultButton } from "./DeleteResultButton";

describe("DeleteResultButton", () => {
  it("확인 대화상자에서 취소하면 지우지 않는다", async () => {
    const deleteResult = vi.fn();
    const user = userEvent.setup();
    render(<DeleteResultButton id="s1" deleteResult={deleteResult} />);

    await user.click(screen.getByRole("button", { name: "삭제" }));
    const dialog = screen.getByRole("alertdialog", { name: "저장한 결과를 지울까요?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(deleteResult).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("Esc로 닫는다", async () => {
    const user = userEvent.setup();
    render(<DeleteResultButton id="s1" deleteResult={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "삭제" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("확인하면 id로 삭제를 부른다", async () => {
    const deleteResult = vi.fn(async () => undefined as unknown as DeleteResultResult);
    const user = userEvent.setup();
    render(<DeleteResultButton id="s1" deleteResult={deleteResult} />);

    await user.click(screen.getByRole("button", { name: "삭제" }));
    await user.click(screen.getByRole("button", { name: "지우기" }));

    expect(deleteResult).toHaveBeenCalledWith("s1");
  });

  it("실패하면 이유를 알려 준다", async () => {
    const deleteResult = vi.fn(async (): Promise<DeleteResultResult> => ({ ok: false, error: "not-found" }));
    const user = userEvent.setup();
    render(<DeleteResultButton id="s1" deleteResult={deleteResult} />);

    await user.click(screen.getByRole("button", { name: "삭제" }));
    await user.click(screen.getByRole("button", { name: "지우기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("이미 지워졌거나 찾을 수 없는 결과예요");
  });
});
