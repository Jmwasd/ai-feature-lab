import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MODAL_TRANSITION_MS, Modal } from "./Modal";

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    onClose?.();
    setOpen(false);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        열기
      </button>
      <Modal open={open} onClose={close} labelledBy="modal-title">
        <h2 id="modal-title">제목</h2>
        <button type="button">첫 버튼</button>
        <button type="button">마지막 버튼</button>
      </Modal>
    </>
  );
}

async function openModal() {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: "열기" }));
  return user;
}

describe("Modal", () => {
  it("닫혀 있으면 아무것도 렌더링하지 않는다", () => {
    render(<Modal open={false} onClose={() => {}} labelledBy="t" />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("열면 제목과 연결된 modal dialog를 띄우고 다음 프레임에 보이는 상태로 전환한다", async () => {
    await openModal();
    const dialog = screen.getByRole("dialog", { name: "제목" });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveClass("rounded-card", "bg-canvas", "shadow-float");
    await waitFor(() => expect(dialog).toHaveAttribute("data-state", "open"));
  });

  it("흰 막(bg-canvas/70)으로 화면을 덮고 열려 있는 동안 페이지 스크롤을 막는다", async () => {
    const user = await openModal();

    expect(screen.getByTestId("modal-backdrop")).toHaveClass("fixed", "inset-0", "bg-canvas/70");
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe("");
  });

  it("열면 패널 안 첫 번째 포커스 대상으로 포커스를 옮긴다", async () => {
    await openModal();

    // 첫 포커스 대상은 오른쪽 위 닫기 버튼보다 앞선 본문 요소다.
    await waitFor(() => expect(screen.getByRole("button", { name: "첫 버튼" })).toHaveFocus());
  });

  it("Tab과 Shift+Tab은 패널 안에서만 돈다", async () => {
    const user = await openModal();
    const first = screen.getByRole("button", { name: "첫 버튼" });
    const close = screen.getByRole("button", { name: "닫기" });
    await waitFor(() => expect(first).toHaveFocus());

    await user.tab();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab({ shift: true });
    expect(close).toHaveFocus();
  });

  it("Escape, 닫기 버튼, 바깥 막 클릭으로 닫고 패널 안 클릭으로는 닫지 않는다", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole("button", { name: "열기" });

    await user.click(opener);
    await user.click(screen.getByRole("heading", { name: "제목" }));
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(2);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(opener);
    await user.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("닫으면 사라지는 전환 동안 남아 있다가 내리고, 연 버튼으로 포커스를 돌려준다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<Harness />);
      const opener = screen.getByRole("button", { name: "열기" });
      await user.click(opener);
      const dialog = screen.getByRole("dialog");

      await user.keyboard("{Escape}");
      expect(dialog).toHaveAttribute("data-state", "closed");
      expect(dialog).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(MODAL_TRANSITION_MS);
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });
});
