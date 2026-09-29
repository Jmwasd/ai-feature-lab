import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LookupForm } from "./LookupForm";
import type { AddressCandidate } from "./schema";

const candidates: AddressCandidate[] = [
  {
    id: "a1",
    roadAddress: "서울특별시 마포구 월드컵북로 100",
    jibunAddress: "서울특별시 마포구 성산동 100",
    buildingName: "성산빌라",
    admCd: "1144012500",
  },
  {
    id: "a2",
    roadAddress: "서울특별시 마포구 월드컵북로 102",
    jibunAddress: "서울특별시 마포구 성산동 102",
    buildingName: null,
    admCd: "1144012500",
  },
];

function setup(searchAddress = vi.fn(async () => candidates)) {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<LookupForm searchAddress={searchAddress} onSubmit={onSubmit} />);
  return { user, onSubmit, searchAddress };
}

// 모바일 하단 바와 desktop 오브가 모두 DOM에 있다(CSS로 하나만 보인다).
function submitButton() {
  return screen.getAllByRole("button", { name: "조회하기" })[0];
}

async function pickAddress(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("주소"), "월드컵북로");
  await user.click(screen.getByRole("button", { name: "주소 검색" }));
  await user.click(await screen.findByRole("button", { name: /월드컵북로 100/ }));
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await pickAddress(user);
  await user.click(screen.getByRole("radio", { name: "연립다세대" }));
  await user.type(screen.getByLabelText("보증금"), "2억 8000만");
  await user.type(screen.getByLabelText("전용면적(㎡)"), "59.8");
}

describe("LookupForm", () => {
  describe("주소 검색 호출 시점", () => {
    it("입력하는 동안에는 호출하지 않는다", async () => {
      const { user, searchAddress } = setup();
      await user.type(screen.getByLabelText("주소"), "월드컵북로");

      expect(searchAddress).not.toHaveBeenCalled();
    });

    it("검색 버튼을 누르면 입력한 검색어로 한 번 호출한다", async () => {
      const { user, searchAddress } = setup();
      await user.type(screen.getByLabelText("주소"), "  월드컵북로 ");
      await user.click(screen.getByRole("button", { name: "주소 검색" }));

      expect(searchAddress).toHaveBeenCalledTimes(1);
      expect(searchAddress).toHaveBeenCalledWith("월드컵북로");
    });

    it("주소 칸에서 Enter를 누르면 검색하고 폼을 제출하지 않는다", async () => {
      const { user, searchAddress, onSubmit } = setup();
      await user.type(screen.getByLabelText("주소"), "월드컵북로{Enter}");

      expect(searchAddress).toHaveBeenCalledTimes(1);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(await screen.findByRole("button", { name: /월드컵북로 100/ })).toBeInTheDocument();
    });

    it("검색어가 비어 있으면 호출하지 않고 안내한다", async () => {
      const { user, searchAddress } = setup();
      await user.click(screen.getByRole("button", { name: "주소 검색" }));

      expect(searchAddress).not.toHaveBeenCalled();
      expect(screen.getByText("검색할 주소를 입력해 주세요")).toBeInTheDocument();
    });
  });

  describe("검색 상태", () => {
    it("응답을 기다리는 동안 로딩을 보인다", async () => {
      let resolve: (value: AddressCandidate[]) => void = () => {};
      const pending = new Promise<AddressCandidate[]>((r) => (resolve = r));
      const { user } = setup(vi.fn(() => pending));
      await user.type(screen.getByLabelText("주소"), "월드컵북로{Enter}");

      expect(screen.getByText("주소를 찾고 있어요")).toBeInTheDocument();
      resolve(candidates);
      expect(await screen.findByRole("button", { name: /월드컵북로 100/ })).toBeInTheDocument();
      expect(screen.queryByText("주소를 찾고 있어요")).not.toBeInTheDocument();
    });

    it("결과가 없으면 안내한다", async () => {
      const { user } = setup(vi.fn(async () => []));
      await user.type(screen.getByLabelText("주소"), "없는주소{Enter}");

      expect(await screen.findByText(/검색 결과가 없어요/)).toBeInTheDocument();
    });

    it("검색이 실패하면 오류를 보인다", async () => {
      const { user } = setup(vi.fn(async () => Promise.reject(new Error("network"))));
      await user.type(screen.getByLabelText("주소"), "월드컵북로{Enter}");

      expect(await screen.findByText(/주소를 불러오지 못했어요/)).toBeInTheDocument();
    });

    it("후보에 도로명·지번·건물명을 보이고, 고르면 목록을 닫고 선택한 주소를 보인다", async () => {
      const { user } = setup();
      await user.type(screen.getByLabelText("주소"), "월드컵북로{Enter}");
      const list = await screen.findByRole("list", { name: "주소 검색 결과" });

      expect(within(list).getByText("서울특별시 마포구 성산동 100")).toBeInTheDocument();
      expect(within(list).getByText("성산빌라")).toBeInTheDocument();

      await user.click(within(list).getByRole("button", { name: /월드컵북로 100/ }));

      expect(screen.queryByRole("list", { name: "주소 검색 결과" })).not.toBeInTheDocument();
      expect(screen.getByLabelText("주소")).toHaveValue("서울특별시 마포구 월드컵북로 100");
    });
  });

  it("주택 유형은 아파트와 연립다세대 두 가지뿐이다", () => {
    setup();
    const group = screen.getByRole("radiogroup", { name: "주택 유형" });
    const options = within(group).getAllByRole("radio");

    expect(options.map((option) => option.closest("label")?.textContent)).toEqual(["아파트", "연립다세대"]);
    expect(screen.queryByText(/오피스텔|다가구|단독/)).not.toBeInTheDocument();
  });

  it("주택 유형 탭은 고른 것만 선택 상태가 된다", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("radio", { name: "아파트" }));

    expect(screen.getByRole("radio", { name: "아파트" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "연립다세대" })).not.toBeChecked();
  });

  describe("제출", () => {
    it("주소 후보를 고르기 전에는 제출하지 않고 오류를 보인다", async () => {
      const { user, onSubmit } = setup();
      await user.type(screen.getByLabelText("주소"), "월드컵북로");
      await user.click(screen.getByRole("radio", { name: "아파트" }));
      await user.type(screen.getByLabelText("보증금"), "28000");
      await user.type(screen.getByLabelText("전용면적(㎡)"), "84");
      await user.click(submitButton());

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByLabelText("주소")).toHaveAccessibleDescription("주소를 검색해서 목록에서 골라 주세요");
    });

    it("후보를 고른 뒤 검색어를 고치면 선택이 풀린다", async () => {
      const { user, onSubmit } = setup();
      await fillValid(user);
      await user.type(screen.getByLabelText("주소"), " 2층");
      await user.click(submitButton());

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByLabelText("주소")).toHaveAttribute("aria-invalid", "true");
    });

    it("유효한 입력이면 원·㎡ 단위로 변환한 값을 onSubmit에 넘긴다", async () => {
      const { user, onSubmit } = setup();
      await fillValid(user);
      await user.type(screen.getByLabelText("동"), "101동");
      await user.type(screen.getByLabelText("호"), "203");
      await user.click(submitButton());

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({
        address: candidates[0],
        houseType: "row-house",
        deposit: 280_000_000,
        exclusiveArea: 59.8,
        dong: "101동",
        ho: "203",
      });
    });

    it("동·호를 비우면 없는 값으로 넘긴다", async () => {
      const { user, onSubmit } = setup();
      await fillValid(user);
      await user.click(submitButton());

      const input = onSubmit.mock.calls[0][0];
      expect(input.dong).toBeUndefined();
      expect(input.ho).toBeUndefined();
    });

    it("필드별 오류를 해당 입력의 오류 상태로 보인다", async () => {
      const { user, onSubmit } = setup();
      await pickAddress(user);
      await user.type(screen.getByLabelText("보증금"), "2억 8천");
      await user.type(screen.getByLabelText("전용면적(㎡)"), "0");
      await user.click(submitButton());

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByLabelText("보증금")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText("보증금")).toHaveAccessibleDescription(/예: 2억 8000만/);
      expect(screen.getByLabelText("전용면적(㎡)")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByText("주택 유형을 골라 주세요")).toBeInTheDocument();
      expect(screen.getByLabelText("주소")).not.toHaveAttribute("aria-invalid");
    });

    it("오류가 난 필드를 고치면 그 필드의 오류를 지운다", async () => {
      const { user } = setup();
      await user.click(submitButton());
      expect(screen.getByLabelText("보증금")).toHaveAttribute("aria-invalid", "true");

      await user.type(screen.getByLabelText("보증금"), "2");

      expect(screen.getByLabelText("보증금")).not.toHaveAttribute("aria-invalid");
    });
  });

  it("보증금을 읽을 수 있으면 해석한 금액을 보여준다", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("보증금"), "28000");

    expect(screen.getByLabelText("보증금")).toHaveAccessibleDescription("2억 8,000만 원");
  });

  describe("동·호 안내", () => {
    const NOTICE = "동·호를 입력하면 공시가격으로 HUG 기준을 계산해요";

    it("동·호가 비어 있으면 안내를 보인다", () => {
      setup();
      expect(screen.getByText(NOTICE)).toBeInTheDocument();
    });

    it("동·호를 모두 입력하면 안내를 숨긴다", async () => {
      const { user } = setup();
      await user.type(screen.getByLabelText("동"), "101");
      expect(screen.getByText(NOTICE)).toBeInTheDocument();

      await user.type(screen.getByLabelText("호"), "203");
      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    });
  });

  it("defaultValue로 받은 값을 채우고 그대로 제출할 수 있다", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <LookupForm
        searchAddress={vi.fn(async () => [])}
        onSubmit={onSubmit}
        defaultValue={{ address: candidates[1], houseType: "apartment", deposit: 280_000_000, exclusiveArea: 84.97, dong: "101" }}
      />,
    );

    expect(screen.getByLabelText("주소")).toHaveValue(candidates[1].roadAddress);
    expect(screen.getByLabelText("보증금")).toHaveValue("2억 8,000만");
    await user.click(submitButton());

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        address: candidates[1],
        houseType: "apartment",
        deposit: 280_000_000,
        exclusiveArea: 84.97,
        dong: "101",
      }),
    );
  });

  it("defaultKeyword는 검색어만 채우고 주소를 고른 것으로 치지 않는다", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <LookupForm
        searchAddress={vi.fn(async () => candidates)}
        onSubmit={onSubmit}
        defaultKeyword={candidates[0].roadAddress}
        defaultValue={{ houseType: "row-house", deposit: 150_000_000, exclusiveArea: 59 }}
      />,
    );

    expect(screen.getByLabelText("주소")).toHaveValue(candidates[0].roadAddress);
    await user.click(submitButton());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("주소를 검색해서 목록에서 골라 주세요")).toBeInTheDocument();
  });

  it("레드 CTA는 모바일 하단 바와 desktop 오브 하나씩이다", () => {
    setup();
    const buttons = screen.getAllByRole("button", { name: "조회하기" });
    const bar = buttons.find((button) => button.closest("[data-testid=mobile-cta]"));
    const orb = buttons.find((button) => button !== bar);

    expect(buttons).toHaveLength(2);

    expect(bar?.closest("[data-testid=mobile-cta]")).toHaveClass("fixed", "bottom-0", "desktop:hidden");
    expect(orb).toHaveClass("bg-primary", "rounded-full");
  });
});
