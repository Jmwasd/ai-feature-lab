import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import { LoginDialog } from "./LoginDialog";

async function openDialog(signIn = vi.fn(async () => {})) {
  const user = userEvent.setup();
  render(<LoginDialog signIn={signIn} />);
  await user.click(screen.getByRole("button", { name: "로그인" }));
  return { user, signIn, dialog: screen.getByRole("dialog", { name: "로그인" }) };
}

describe("LoginDialog", () => {
  it("처음에는 secondary '로그인' 버튼만 있고 모달은 닫혀 있다", () => {
    render(<LoginDialog signIn={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "로그인" });

    expect(trigger).toHaveClass("border-ink");
    expect(trigger).not.toHaveClass("bg-primary");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("버튼을 누르면 워드마크·제목·설명·Google 버튼·약관 안내가 있는 모달을 연다", async () => {
    const { dialog } = await openDialog();
    const panel = within(dialog);

    expect(panel.getByText("jeonse-check")).toHaveClass("text-primary");
    expect(panel.getByRole("heading", { name: "로그인" })).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription("진단 결과를 저장하고, 계약 전에 다시 확인할 수 있어요.");
    const google = panel.getByRole("button", { name: "Google로 계속하기" });
    expect(google).toHaveAttribute("type", "submit");
    expect(google).toHaveClass("w-full", "border-hairline", "rounded-button");
    expect(panel.getByText(/동의하는 것으로 봐요/)).toHaveClass("text-caption-sm", "text-muted");
    expectNoForbiddenPhrases(dialog.textContent ?? "");
  });

  it("Google 버튼을 누르면 signIn 액션을 부른다", async () => {
    const { user, signIn, dialog } = await openDialog();

    await user.click(within(dialog).getByRole("button", { name: "Google로 계속하기" }));

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
  });

  it("닫으면 로그인 버튼으로 포커스를 돌려준다", async () => {
    const { user } = await openDialog();

    await user.click(screen.getByRole("button", { name: "닫기" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "로그인" })).toHaveFocus();
  });
});
