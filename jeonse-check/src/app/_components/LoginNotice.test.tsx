import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/server/auth", () => ({ auth, signIn: vi.fn(), signOut: vi.fn() }));

import { LoginNotice } from "./LoginNotice";

beforeEach(() => {
  auth.mockReset();
});

describe("LoginNotice", () => {
  it("비로그인이면 안내와 callbackUrl을 담은 primary Google 로그인 버튼을 보여준다", async () => {
    auth.mockResolvedValue(null);
    render(await LoginNotice({ callbackUrl: "/check?deposit=1" }));
    const button = screen.getByRole("button", { name: "Google로 로그인" });
    const form = button.closest("form")!;

    expect(screen.getByText("로그인이 필요해요")).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveClass("bg-primary");
    expect(form.querySelector<HTMLInputElement>('input[type="hidden"][name="callbackUrl"]')?.value).toBe("/check?deposit=1");
  });

  it("같은 사이트 상대 경로가 아니면 /check를 넘긴다", async () => {
    auth.mockResolvedValue(null);
    const { container } = render(await LoginNotice({ callbackUrl: "//evil.com" }));

    expect(container.querySelector<HTMLInputElement>('input[name="callbackUrl"]')?.value).toBe("/check");
  });

  it("이미 로그인했으면 아무것도 보여주지 않는다", async () => {
    auth.mockResolvedValue({ user: { id: "u1" }, expires: "2099-01-01T00:00:00.000Z" });

    expect(await LoginNotice({ callbackUrl: "/check" })).toBeNull();
  });
});
