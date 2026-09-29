import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LoadMoreSavedResult } from "../_actions/list-saved";
import type { SavedListItem } from "../_lib/saved-list";
import { SavedList } from "./SavedList";

function item(id: string): SavedListItem {
  return { id, addressDisplay: `주소 ${id}`, headline: "위험 신호 1개", dataBaseDate: "2026-09-01", savedAt: "2026-09-30" };
}

function rows() {
  return within(screen.getByRole("list", { name: "저장한 결과" })).getAllByRole("listitem");
}

describe("SavedList", () => {
  it("'더 보기'를 누르면 다음 페이지를 뒤에 붙이고, 마지막 페이지면 버튼을 숨긴다", async () => {
    const loadMore = vi.fn(async (): Promise<LoadMoreSavedResult> => ({ ok: true, page: { items: [item("c")], nextCursor: null } }));
    const user = userEvent.setup();
    render(<SavedList initial={{ items: [item("a"), item("b")], nextCursor: "b" }} loadMore={loadMore} />);

    await user.click(screen.getByRole("button", { name: "더 보기" }));

    expect(loadMore).toHaveBeenCalledWith("b");
    expect(rows()).toHaveLength(3);
    expect(rows()[2]).toHaveTextContent("주소 c");
    expect(screen.queryByRole("button", { name: "더 보기" })).not.toBeInTheDocument();
  });

  it("불러오지 못하면 안내를 보여 주고 다시 누를 수 있다", async () => {
    const loadMore = vi
      .fn<() => Promise<LoadMoreSavedResult>>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ ok: true, page: { items: [item("c")], nextCursor: "c" } });
    const user = userEvent.setup();
    render(<SavedList initial={{ items: [item("a")], nextCursor: "a" }} loadMore={loadMore} />);

    await user.click(screen.getByRole("button", { name: "더 보기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("목록을 더 불러오지 못했어요");

    await user.click(screen.getByRole("button", { name: "더 보기" }));
    expect(rows()).toHaveLength(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("세션이 끝났으면 다시 로그인하라고 안내한다", async () => {
    const loadMore = vi.fn(async (): Promise<LoadMoreSavedResult> => ({ ok: false, error: "unauthorized" }));
    const user = userEvent.setup();
    render(<SavedList initial={{ items: [item("a")], nextCursor: "a" }} loadMore={loadMore} />);

    await user.click(screen.getByRole("button", { name: "더 보기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("다시 로그인");
  });
});
