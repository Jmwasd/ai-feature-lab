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
  return screen.getAllByRole("button", { name: "다음" })[0];
}

function nextButtons() {
  return screen.queryAllByRole("button", { name: "다음" });
}

// 주소 칸은 주택 유형을 고른 뒤에 나타난다.
async function setupAtAddress(searchAddress?: Parameters<typeof setup>[0]) {
  const ctx = setup(searchAddress);
  await ctx.user.click(screen.getByRole("radio", { name: "연립다세대" }));
  return ctx;
}

async function pickAddress(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("주소"), "월드컵북로");
  await user.click(screen.getByRole("button", { name: "주소 검색" }));
  await user.click(await screen.findByRole("button", { name: /월드컵북로 100/ }));
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: "연립다세대" }));
  await pickAddress(user);
  await user.type(screen.getByLabelText("보증금"), "2억 8000만");
  await user.type(screen.getByLabelText("전용면적(㎡)"), "59.8");
}

describe("LookupForm", () => {
  describe("주소 검색 호출 시점", () => {
    it("입력하는 동안에는 호출하지 않는다", async () => {
      const { user, searchAddress } = await setupAtAddress();
      await user.type(screen.getByLabelText("주소"), "월드컵북로");

      expect(searchAddress).not.toHaveBeenCalled();
    });

    it("검색 버튼을 누르면 입력한 검색어로 한 번 호출한다", async () => {
      const { user, searchAddress } = await setupAtAddress();
      await user.type(screen.getByLabelText("주소"), "  월드컵북로 ");
      await user.click(screen.getByRole("button", { name: "주소 검색" }));

      expect(searchAddress).toHaveBeenCalledTimes(1);
      expect(searchAddress).toHaveBeenCalledWith("월드컵북로");
    });

    it("주소 칸에서 Enter를 누르면 검색하고 폼을 제출하지 않는다", async () => {
      const { user, searchAddress, onSubmit } = await setupAtAddress();
      await user.type(screen.getByLabelText("주소"), "월드컵북로{Enter}");

      expect(searchAddress).toHaveBeenCalledTimes(1);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(await screen.findByRole("button", { name: /월드컵북로 100/ })).toBeInTheDocument();
    });

    it("검색어가 비어 있으면 호출하지 않고 안내한다", async () => {
      const { user, searchAddress } = await setupAtAddress();
      await user.click(screen.getByRole("button", { name: "주소 검색" }));

      expect(searchAddress).not.toHaveBeenCalled();
      expect(screen.getByText("검색할 주소를 입력해 주세요")).toBeInTheDocument();
    });
  });

  it("주택 유형은 아파트와 연립다세대 두 가지뿐이다", () => {
    setup();
    const group = screen.getByRole("radiogroup", { name: "주택 유형" });
    const options = within(group).getAllByRole("radio");

    expect(options.map((option) => option.closest("label")?.textContent)).toEqual(["아파트", "연립다세대"]);
    expect(screen.queryByText(/오피스텔|다가구|단독/)).not.toBeInTheDocument();
  });

  describe("단계별로 칸이 나타난다", () => {
    it("처음에는 주택 유형만 있고 주소·보증금·전용면적·동·호·다음 버튼이 없다", () => {
      setup();

      expect(screen.getByRole("radiogroup", { name: "주택 유형" })).toBeInTheDocument();
      for (const label of ["주소", "보증금", "전용면적(㎡)", "동", "호"]) {
        expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
      }
      expect(nextButtons()).toHaveLength(0);
    });

    it("주택 유형을 고르면 주소 칸이 나타나고 그 칸으로 포커스를 옮긴다", async () => {
      const { user } = setup();
      await user.click(screen.getByRole("radio", { name: "아파트" }));

      await waitFor(() => expect(screen.getByLabelText("주소")).toHaveFocus());
      expect(screen.queryByLabelText("보증금")).not.toBeInTheDocument();
    });

    it("주소는 검색어만으로는 다음 칸을 열지 않고, 후보를 고르면 보증금 칸을 열어 포커스를 옮긴다", async () => {
      const { user } = await setupAtAddress();
      await user.type(screen.getByLabelText("주소"), "월드컵북로");
      expect(screen.queryByLabelText("보증금")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "주소 검색" }));
      await user.click(await screen.findByRole("button", { name: /월드컵북로 100/ }));

      await waitFor(() => expect(screen.getByLabelText("보증금")).toHaveFocus());
      expect(screen.queryByLabelText("전용면적(㎡)")).not.toBeInTheDocument();
    });

    it("보증금을 읽을 수 있어야 전용면적 칸이 나타난다", async () => {
      const { user } = await setupAtAddress();
      await pickAddress(user);
      await user.type(screen.getByLabelText("보증금"), "이억");
      expect(screen.queryByLabelText("전용면적(㎡)")).not.toBeInTheDocument();

      await user.clear(screen.getByLabelText("보증금"));
      await user.type(screen.getByLabelText("보증금"), "2억 8000만");
      expect(screen.getByLabelText("전용면적(㎡)")).toBeInTheDocument();
    });

    it("전용면적까지 채우면 동·호 칸과 다음 버튼(모바일 하단 바 + desktop 오브)이 나타난다", async () => {
      const { user } = setup();
      await fillValid(user);

      expect(screen.getByLabelText("동")).toBeInTheDocument();
      expect(screen.getByLabelText("호")).toBeInTheDocument();
      expect(nextButtons()).toHaveLength(2);
    });

    it("앞 칸을 고쳐 다시 비면 이미 나타난 칸은 남기고 다음 버튼만 숨긴다", async () => {
      const { user } = setup();
      await fillValid(user);
      await user.clear(screen.getByLabelText("보증금"));

      expect(screen.getByLabelText("전용면적(㎡)")).toHaveValue("59.8");
      expect(nextButtons()).toHaveLength(0);
    });

    it("후보를 고른 뒤 검색어를 고치면 선택이 풀려 다음 버튼을 숨긴다", async () => {
      const { user } = setup();
      await fillValid(user);
      await user.type(screen.getByLabelText("주소"), " 2층");

      expect(nextButtons()).toHaveLength(0);
    });
  });

  describe("제출", () => {
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
  });

  describe("칸을 벗어날 때 오류", () => {
    it("읽을 수 없는 보증금은 칸을 벗어나면 오류로 보이고 고치면 지운다", async () => {
      const { user } = await setupAtAddress();
      await pickAddress(user);
      await user.type(screen.getByLabelText("보증금"), "2억 8천");
      await user.tab();

      expect(screen.getByLabelText("보증금")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText("보증금")).toHaveAccessibleDescription(/예: 2억 8000만/);

      await user.type(screen.getByLabelText("보증금"), "0");
      expect(screen.getByLabelText("보증금")).not.toHaveAttribute("aria-invalid");
    });

    it("0 이하이거나 숫자가 아닌 전용면적은 칸을 벗어나면 오류로 보인다", async () => {
      const { user } = setup();
      await fillValid(user);
      await user.clear(screen.getByLabelText("전용면적(㎡)"));
      await user.type(screen.getByLabelText("전용면적(㎡)"), "0");
      await user.tab();

      expect(screen.getByLabelText("전용면적(㎡)")).toHaveAttribute("aria-invalid", "true");
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
    // 다른 칸은 처음부터 모두 보이지만, 주소를 다시 골라야 다음 버튼이 나타난다.
    expect(screen.getByLabelText("전용면적(㎡)")).toHaveValue("59");
    expect(nextButtons()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "주소 검색" }));
    await user.click(await screen.findByRole("button", { name: /월드컵북로 100/ }));
    await user.click(submitButton());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("다음 버튼은 모바일 하단 바와 desktop 오브 두 곳에 있다", async () => {
    const { user } = setup();
    await fillValid(user);
    const buttons = screen.getAllByRole("button", { name: "다음" });
    expect(buttons).toHaveLength(2);
  });
});
