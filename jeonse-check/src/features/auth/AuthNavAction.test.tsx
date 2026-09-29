import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/server/auth", () => ({ auth, signIn: vi.fn(), signOut: vi.fn() }));

import { AuthNavAction } from "./AuthNavAction";

beforeEach(() => {
  auth.mockReset();
});

describe("AuthNavAction", () => {
  it("비로그인이면 /check로 가는 secondary '지금 확인하기'만 보인다", async () => {
    auth.mockResolvedValue(null);
    render(await AuthNavAction());
    const cta = screen.getByRole("link", { name: "지금 확인하기" });

    expect(cta).toHaveAttribute("href", "/check");
    expect(cta).toHaveClass("border-ink");
    expect(cta).not.toHaveClass("bg-primary");
    expect(screen.queryByRole("button", { name: "로그아웃" })).not.toBeInTheDocument();
  });

  it("로그인 상태면 '내 조회' 링크와 tertiary-text 로그아웃 버튼이 보인다", async () => {
    auth.mockResolvedValue({ user: { id: "u1", name: "홍길동" }, expires: "2099-01-01T00:00:00.000Z" });
    render(await AuthNavAction());
    const mine = screen.getByRole("link", { name: "내 조회" });
    const logout = screen.getByRole("button", { name: "로그아웃" });

    expect(mine).toHaveAttribute("href", "/check");
    expect(mine).not.toHaveClass("bg-primary");
    expect(logout).toHaveAttribute("type", "submit");
    expect(logout).toHaveClass("underline");
    expect(logout.closest("form")).not.toBeNull();
    expect(screen.queryByRole("link", { name: "지금 확인하기" })).not.toBeInTheDocument();
  });
});
