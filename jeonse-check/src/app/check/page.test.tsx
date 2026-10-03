import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, redirect, getForUser } = vi.hoisted(() => ({
  auth: vi.fn(),
  getForUser: vi.fn(),
  // 실제 redirect처럼 이후 코드가 실행되지 않게 던진다.
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("@/server/auth", () => ({ auth, signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
// 비동기 Server Component는 jsdom에서 렌더링할 수 없어 자리 표시로 바꾼다. 자체 동작은 AuthTopNav.test.tsx가 검증한다.
vi.mock("@/features/auth/AuthTopNav", () => ({ AuthTopNav: () => <span>auth-top-nav</span> }));
// 흐름 자체는 CheckFlow.test.tsx가 검증한다. 여기서는 Server Action을 넘기는지만 본다.
vi.mock("./_actions/run-check", () => ({ runCheckAction: vi.fn() }));
vi.mock("./_actions/save-result", () => ({ saveResultAction: vi.fn() }));
vi.mock("./_actions/search-address", () => ({ searchAddressAction: vi.fn() }));
vi.mock("@/server/saved/prisma-repository", () => ({ createPrismaSavedResultRepository: () => ({ getForUser }) }));

import CheckPage from "./page";

const SESSION = { user: { id: "u1", name: "홍길동" }, expires: "2099-01-01T00:00:00.000Z" };

function props(searchParams: Record<string, string | string[] | undefined> = {}) {
  return { searchParams: Promise.resolve(searchParams) };
}

beforeEach(() => {
  auth.mockReset();
  getForUser.mockReset().mockResolvedValue(null);
  redirect.mockClear();
});

describe("/check 페이지", () => {
  it("세션이 없으면 /?callbackUrl=/check로 redirect한다", async () => {
    auth.mockResolvedValue(null);

    await expect(CheckPage(props())).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/?callbackUrl=/check");
  });

  it("세션이 있으면 조회 흐름의 첫 단계와 사용자 이름을 보여준다", async () => {
    auth.mockResolvedValue({ user: { id: "u1", name: "홍길동" }, expires: "2099-01-01T00:00:00.000Z" });
    render(await CheckPage(props()));

    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: "주소와 보증금을 입력해 주세요" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "조회 조건" })).toBeInTheDocument();
    expect(screen.getByText(/홍길동/)).toBeInTheDocument();
    expect(screen.getByText("auth-top-nav")).toBeInTheDocument();
  });

  it("?from=저장 id면 그 사용자의 저장 결과 입력으로 폼을 미리 채운다", async () => {
    auth.mockResolvedValue(SESSION);
    getForUser.mockResolvedValue({
      id: "s1",
      userId: "u1",
      input: {
        address: { display: "서울특별시 마포구 망원로 1" },
        houseType: "row-house",
        deposit: 150_000_000,
        exclusiveArea: 59.8,
        rights: { maxClaimAmount: 0, seniorDeposits: 0, isTrust: false, lastOwnershipChangeDate: null },
      },
      result: {},
      dataBaseDate: new Date("2026-09-01T00:00:00Z"),
      createdAt: new Date("2026-09-30T00:00:00Z"),
    });
    render(await CheckPage(props({ from: "s1" })));

    expect(getForUser).toHaveBeenCalledWith("u1", "s1");
    expect(screen.getByLabelText("주소")).toHaveValue("서울특별시 마포구 망원로 1");
    expect(screen.getByLabelText("전용면적(㎡)")).toHaveValue("59.8");
  });

  it("?from이 남의 것이거나 없는 id면 빈 폼으로 시작한다", async () => {
    auth.mockResolvedValue(SESSION);
    render(await CheckPage(props({ from: "other" })));

    expect(getForUser).toHaveBeenCalledWith("u1", "other");
    expect(screen.getByLabelText("주소")).toHaveValue("");
  });

  it("?from이 없으면 저장소를 조회하지 않는다", async () => {
    auth.mockResolvedValue(SESSION);
    render(await CheckPage(props()));

    expect(getForUser).not.toHaveBeenCalled();
  });
});
