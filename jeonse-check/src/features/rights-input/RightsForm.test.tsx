import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RightsInput } from "@/features/judgment/types";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import { RightsForm, type RightsFormValue } from "./RightsForm";

// 폼 출력이 judgment의 RightsInput과 구조가 같은지 컴파일 시점에 검사한다. 제품 코드는 judgment를 import하지 않는다.
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const formValueMatchesRightsInput: Equals<RightsFormValue, RightsInput> = true;
void formValueMatchesRightsInput;

const asOf = new Date(2026, 8, 30, 12);
type User = ReturnType<typeof userEvent.setup>;

function setup(props: Partial<Parameters<typeof RightsForm>[0]> = {}) {
  const onSubmit = vi.fn<(rights: RightsFormValue) => void>();
  const user = userEvent.setup();
  const view = render(<RightsForm onSubmit={onSubmit} asOf={asOf} {...props} />);
  return { user, onSubmit, container: view.container };
}

function submit(user: User) {
  return user.click(screen.getByRole("button", { name: "위험 신호 확인하기" }));
}

// 근저당 외 필드를 채운다.
async function fillOthers(user: User) {
  await user.type(screen.getByLabelText("선순위 임차보증금 합계"), "0");
  await user.click(within(screen.getByRole("radiogroup", { name: "신탁 등기" })).getByRole("radio", { name: "아니오" }));
  await user.type(screen.getByLabelText("최근 소유권 이전 등기일"), "2024-03-15");
}

describe("RightsForm", () => {
  it("폼 상단에 등기부 기준 안내를 보인다", () => {
    setup();
    expect(screen.getByText("입력한 등기부 내용으로만 판단해요. 계약 당일 등기부를 다시 확인하세요")).toBeInTheDocument();
    expect(screen.getByText(/사용자 입력\(등기부 기준\)/)).toBeInTheDocument();
  });

  it("필드마다 등기부에서 볼 곳을 안내한다", () => {
    setup();
    expect(screen.getByText(/을구 → 근저당권설정 → 채권최고액/)).toBeInTheDocument();
    expect(screen.getByText(/을구 → 전세권설정·임차권등기/)).toBeInTheDocument();
    expect(screen.getByText(/갑구 → 소유권이전 등기의 목적/)).toBeInTheDocument();
    expect(screen.getByText(/갑구 → 마지막 소유권이전 → 접수일/)).toBeInTheDocument();
  });

  describe("근저당", () => {
    it("처음에는 있음·없음 어느 쪽도 고르지 않은 상태다", () => {
      setup();
      const group = screen.getByRole("radiogroup", { name: "근저당" });
      for (const radio of within(group).getAllByRole("radio")) expect(radio).not.toBeChecked();
    });

    it("여러 건의 채권최고액을 더한 합계를 보이고 합계만 넘긴다", async () => {
      const { user, onSubmit } = setup();
      await user.click(screen.getByRole("radio", { name: "근저당 있음" }));
      await user.type(screen.getByLabelText("근저당 1 채권최고액"), "1억 2000만");
      await user.click(screen.getByRole("button", { name: "근저당 추가" }));
      await user.type(screen.getByLabelText("근저당 2 채권최고액"), "8000만");

      expect(screen.getByText("합계 2억 원")).toBeInTheDocument();

      await fillOthers(user);
      await submit(user);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit.mock.calls[0][0].maxClaimAmount).toBe(200_000_000);
    });

    it("삭제한 건은 합계에서 빠진다", async () => {
      const { user, onSubmit } = setup();
      await user.click(screen.getByRole("radio", { name: "근저당 있음" }));
      await user.type(screen.getByLabelText("근저당 1 채권최고액"), "1억");
      await user.click(screen.getByRole("button", { name: "근저당 추가" }));
      await user.type(screen.getByLabelText("근저당 2 채권최고액"), "6000만");
      await user.click(screen.getByRole("button", { name: "근저당 1 삭제" }));

      expect(screen.getByLabelText("근저당 1 채권최고액")).toHaveValue("6000만");
      expect(screen.queryByLabelText("근저당 2 채권최고액")).not.toBeInTheDocument();
      expect(screen.getByText("합계 6,000만 원")).toBeInTheDocument();

      await fillOthers(user);
      await submit(user);
      expect(onSubmit.mock.calls[0][0].maxClaimAmount).toBe(60_000_000);
    });

    it("한 건만 남으면 삭제할 수 없다", async () => {
      const { user } = setup();
      await user.click(screen.getByRole("radio", { name: "근저당 있음" }));
      expect(screen.queryByRole("button", { name: /근저당 1 삭제/ })).not.toBeInTheDocument();
    });

    it("'근저당 없음'을 고르면 0을 넘긴다", async () => {
      const { user, onSubmit } = setup();
      await user.click(screen.getByRole("radio", { name: "근저당 없음" }));
      expect(screen.queryByLabelText("근저당 1 채권최고액")).not.toBeInTheDocument();

      await fillOthers(user);
      await submit(user);

      expect(onSubmit.mock.calls[0][0].maxClaimAmount).toBe(0);
    });

    it("있음·없음을 고르지 않으면 0으로 채우지 않고 제출을 막는다", async () => {
      const { user, onSubmit } = setup();
      await fillOthers(user);
      await submit(user);

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText("근저당이 있는지 골라 주세요")).toBeInTheDocument();
    });

    it("'근저당 있음'인데 금액이 비었거나 0원이면 제출을 막는다", async () => {
      const { user, onSubmit } = setup();
      await user.click(screen.getByRole("radio", { name: "근저당 있음" }));
      await user.click(screen.getByRole("button", { name: "근저당 추가" }));
      await user.type(screen.getByLabelText("근저당 2 채권최고액"), "0");
      await fillOthers(user);
      await submit(user);

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByLabelText("근저당 1 채권최고액")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText("근저당 2 채권최고액")).toHaveAttribute("aria-invalid", "true");
    });
  });

  describe("신탁 등기", () => {
    it("기본값 없이 예·아니오를 고르게 한다", () => {
      setup();
      const group = screen.getByRole("radiogroup", { name: "신탁 등기" });
      const radios = within(group).getAllByRole("radio");

      expect(radios.map((radio) => radio.closest("label")?.textContent)).toEqual(["예", "아니오"]);
      for (const radio of radios) expect(radio).not.toBeChecked();
    });

    it("고르지 않으면 제출할 수 없다", async () => {
      const { user, onSubmit } = setup();
      await user.click(screen.getByRole("radio", { name: "근저당 없음" }));
      await user.type(screen.getByLabelText("선순위 임차보증금 합계"), "0");
      await user.type(screen.getByLabelText("최근 소유권 이전 등기일"), "2024-03-15");
      await submit(user);

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText("신탁 등기 여부를 골라 주세요")).toBeInTheDocument();
    });

    it("'예'를 고르면 true를 넘긴다", async () => {
      const { user, onSubmit } = setup();
      await user.click(screen.getByRole("radio", { name: "근저당 없음" }));
      await fillOthers(user);
      await user.click(within(screen.getByRole("radiogroup", { name: "신탁 등기" })).getByRole("radio", { name: "예" }));
      await submit(user);

      expect(onSubmit.mock.calls[0][0].isTrust).toBe(true);
    });
  });

  it("선순위 보증금을 비우면 0으로 채우지 않고 오류를 보인다", async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole("radio", { name: "근저당 없음" }));
    await user.click(within(screen.getByRole("radiogroup", { name: "신탁 등기" })).getByRole("radio", { name: "아니오" }));
    await user.type(screen.getByLabelText("최근 소유권 이전 등기일"), "2024-03-15");
    await submit(user);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("선순위 임차보증금 합계")).toHaveAttribute("aria-invalid", "true");
  });

  describe("최근 소유권 이전 등기일", () => {
    it("비우면 없음으로 채우지 않고 오류를 보인다", async () => {
      const { user, onSubmit } = setup();
      await user.click(screen.getByRole("radio", { name: "근저당 없음" }));
      await user.type(screen.getByLabelText("선순위 임차보증금 합계"), "0");
      await user.click(within(screen.getByRole("radiogroup", { name: "신탁 등기" })).getByRole("radio", { name: "아니오" }));
      await submit(user);

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByLabelText("최근 소유권 이전 등기일")).toHaveAttribute("aria-invalid", "true");
    });

    it("미래 날짜는 오류다", async () => {
      const { user, onSubmit } = setup();
      await user.click(screen.getByRole("radio", { name: "근저당 없음" }));
      await user.type(screen.getByLabelText("선순위 임차보증금 합계"), "0");
      await user.click(within(screen.getByRole("radiogroup", { name: "신탁 등기" })).getByRole("radio", { name: "아니오" }));
      await user.type(screen.getByLabelText("최근 소유권 이전 등기일"), "2026-10-01");
      await submit(user);

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByLabelText("최근 소유권 이전 등기일")).toHaveAccessibleDescription("오늘 이후 날짜는 입력할 수 없어요");
    });

    it("'소유권 이전 없음'을 고르면 null을 넘긴다", async () => {
      const { user, onSubmit } = setup();
      await user.click(screen.getByRole("radio", { name: "근저당 없음" }));
      await user.type(screen.getByLabelText("선순위 임차보증금 합계"), "0");
      await user.click(within(screen.getByRole("radiogroup", { name: "신탁 등기" })).getByRole("radio", { name: "아니오" }));
      await user.click(screen.getByRole("checkbox", { name: /소유권 이전 없음/ }));

      expect(screen.getByLabelText("최근 소유권 이전 등기일")).toBeDisabled();
      await submit(user);

      expect(onSubmit.mock.calls[0][0].lastOwnershipChangeDate).toBeNull();
    });
  });

  it("제출 값은 RightsInput과 같은 구조다", async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole("radio", { name: "근저당 있음" }));
    await user.type(screen.getByLabelText("근저당 1 채권최고액"), "2억 4000만");
    await user.type(screen.getByLabelText("선순위 임차보증금 합계"), "5000만");
    await user.click(within(screen.getByRole("radiogroup", { name: "신탁 등기" })).getByRole("radio", { name: "아니오" }));
    await user.type(screen.getByLabelText("최근 소유권 이전 등기일"), "2024-03-15");
    await submit(user);

    const expected: RightsInput = {
      maxClaimAmount: 240_000_000,
      seniorDeposits: 50_000_000,
      isTrust: false,
      lastOwnershipChangeDate: new Date("2024-03-15T00:00:00Z"),
    };
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toStrictEqual(expected);
  });

  it("defaultValue로 받은 값을 채우고 그대로 제출할 수 있다", async () => {
    const defaultValue: RightsFormValue = {
      maxClaimAmount: 0,
      seniorDeposits: 30_000_000,
      isTrust: true,
      lastOwnershipChangeDate: new Date("2025-01-02T00:00:00Z"),
    };
    const { user, onSubmit } = setup({ defaultValue });

    expect(screen.getByRole("radio", { name: "근저당 없음" })).toBeChecked();
    expect(screen.getByLabelText("선순위 임차보증금 합계")).toHaveValue("3,000만");
    await submit(user);

    expect(onSubmit).toHaveBeenCalledWith(defaultValue);
  });

  it("onBack이 있으면 이전 버튼을 보이고 누르면 호출한다", async () => {
    const onBack = vi.fn();
    const { user } = setup({ onBack });
    await user.click(screen.getByRole("button", { name: "이전" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("onBack이 없으면 이전 버튼이 없다", () => {
    setup();
    expect(screen.queryByRole("button", { name: "이전" })).not.toBeInTheDocument();
  });

  it("안내·도움말·오류 문구에 금지 표현이 없다", async () => {
    const { user, container } = setup();
    expectNoForbiddenPhrases(container.textContent ?? "");

    await user.click(screen.getByRole("radio", { name: "근저당 있음" }));
    await submit(user);
    expectNoForbiddenPhrases(container.textContent ?? "");

    await user.click(screen.getByRole("radio", { name: "근저당 없음" }));
    expectNoForbiddenPhrases(container.textContent ?? "");
  });
});
