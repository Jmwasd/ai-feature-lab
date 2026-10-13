import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/server/auth", () => ({ auth, signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("./actions", () => ({ signInWithGoogle: vi.fn(), signOutAction: vi.fn() }));

import { AuthTopNav } from "./AuthTopNav";

beforeEach(() => {
  auth.mockReset();
});

describe("AuthTopNav", () => {
  it.each([
    ["비로그인", null],
    ["로그인", { user: { id: "user-1" } }],
  ])("%s 상태에서도 주요 메뉴 끝에 채팅 로그 링크를 둔다", async (_, session) => {
    auth.mockResolvedValue(session);
    render(await AuthTopNav({ links: [{ href: "#try", label: "계산해 보기" }] }));

    const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["계산해 보기", "채팅 로그"]);
    expect(links.at(-1)).toHaveAttribute("href", "/chat-log");
  });
});
