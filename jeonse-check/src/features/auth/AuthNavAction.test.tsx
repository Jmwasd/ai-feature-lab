import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/server/auth", () => ({ auth, signIn: vi.fn(), signOut: vi.fn() }));

import { AuthNavAction } from "./AuthNavAction";

beforeEach(() => {
  auth.mockReset();
});

describe("AuthNavAction", () => {
  it("비로그인이면 Google 로그인 폼을 보내는 secondary '로그인' 버튼만 보인다", async () => {
    auth.mockResolvedValue(null);
    render(await AuthNavAction());
    const login = screen.getByRole("button", { name: "로그인" });

    expect(login).toHaveAttribute("type", "submit");
    expect(login.closest("form")).not.toBeNull();
    expect(login).toHaveClass("border-ink");
    expect(login).not.toHaveClass("bg-primary");
    expect(screen.queryByRole("button", { name: "로그아웃" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "저장 목록" })).not.toBeInTheDocument();
  });

  it("로그인 상태면 '내 조회'·'저장 목록' 링크와 tertiary-text 로그아웃 버튼이 보인다", async () => {
    auth.mockResolvedValue({ user: { id: "u1", name: "홍길동" }, expires: "2099-01-01T00:00:00.000Z" });
    render(await AuthNavAction());
    const mine = screen.getByRole("link", { name: "내 조회" });
    const logout = screen.getByRole("button", { name: "로그아웃" });

    expect(mine).toHaveAttribute("href", "/check");
    expect(mine).not.toHaveClass("bg-primary");
    expect(screen.getByRole("link", { name: "저장 목록" })).toHaveAttribute("href", "/saved");
    expect(logout).toHaveAttribute("type", "submit");
    expect(logout).toHaveClass("underline");
    expect(logout.closest("form")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "로그인" })).not.toBeInTheDocument();
  });
});
