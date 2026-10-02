import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/server/auth", () => ({ auth, signIn: vi.fn(), signOut: vi.fn() }));

import { AuthTopNav } from "./AuthTopNav";

const links = [{ href: "#try", label: "계산해 보기" }];

beforeEach(() => {
  auth.mockReset();
});

describe("AuthTopNav", () => {
  it("비로그인이면 오른쪽에 로그인 모달을 여는 secondary '로그인' 버튼만 둔다", async () => {
    auth.mockResolvedValue(null);
    render(await AuthTopNav({ links }));
    const header = screen.getByRole("banner");
    const login = within(header).getByRole("button", { name: "로그인" });

    expect(login).toHaveClass("border-ink");
    expect(login).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("navigation", { name: "계정 메뉴" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "로그아웃" })).not.toBeInTheDocument();
  });

  it("로그인 상태면 계정 메뉴에 '내 조회'·'저장 목록' 알약 링크와 secondary 로그아웃 버튼을 둔다", async () => {
    auth.mockResolvedValue({ user: { id: "u1", name: "홍길동" }, expires: "2099-01-01T00:00:00.000Z" });
    render(await AuthTopNav({ links }));
    const account = within(screen.getByRole("navigation", { name: "계정 메뉴" }));

    const mine = account.getByRole("link", { name: "내 조회" });
    const saved = account.getByRole("link", { name: "저장 목록" });
    expect(mine).toHaveAttribute("href", "/check");
    expect(saved).toHaveAttribute("href", "/saved");
    for (const link of [mine, saved]) {
      expect(link).toHaveClass("rounded-full", "text-body", "hover:bg-surface-soft");
      expect(link).not.toHaveClass("underline");
      expect(link.querySelector("svg")).not.toBeNull();
    }
    const logout = account.getByRole("button", { name: "로그아웃" });
    expect(logout).toHaveAttribute("type", "submit");
    expect(logout).toHaveClass("border-ink");
    expect(logout.closest("form")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "로그인" })).not.toBeInTheDocument();
  });
});
