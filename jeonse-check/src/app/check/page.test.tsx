import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, redirect } = vi.hoisted(() => ({
  auth: vi.fn(),
  // 실제 redirect처럼 이후 코드가 실행되지 않게 던진다.
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("@/server/auth", () => ({ auth, signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
// 비동기 Server Component는 jsdom에서 렌더링할 수 없어 자리 표시로 바꾼다. 자체 동작은 AuthNavAction.test.tsx가 검증한다.
vi.mock("@/features/auth/AuthNavAction", () => ({ AuthNavAction: () => <span>auth-nav-action</span> }));
// 흐름 자체는 CheckFlow.test.tsx가 검증한다. 여기서는 Server Action을 넘기는지만 본다.
vi.mock("./_actions/run-check", () => ({ runCheckAction: vi.fn() }));
vi.mock("./_actions/save-result", () => ({ saveResultAction: vi.fn() }));
vi.mock("./_actions/search-address", () => ({ searchAddressAction: vi.fn() }));

import CheckPage from "./page";

beforeEach(() => {
  auth.mockReset();
  redirect.mockClear();
});

describe("/check 페이지", () => {
  it("세션이 없으면 /?callbackUrl=/check로 redirect한다", async () => {
    auth.mockResolvedValue(null);

    await expect(CheckPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/?callbackUrl=/check");
  });

  it("세션이 있으면 조회 흐름의 첫 단계와 사용자 이름을 보여준다", async () => {
    auth.mockResolvedValue({ user: { id: "u1", name: "홍길동" }, expires: "2099-01-01T00:00:00.000Z" });
    render(await CheckPage());

    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: "주소와 보증금을 입력해 주세요" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "조회 조건" })).toBeInTheDocument();
    expect(screen.getByText(/홍길동/)).toBeInTheDocument();
    expect(screen.getByText("auth-nav-action")).toBeInTheDocument();
  });
});
