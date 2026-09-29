import { z } from "zod";

// 권리관계 입력 스키마. 사용자가 등기부등본을 보고 입력한다.
// 출력 구조는 judgment의 RightsInput과 같다. feature 간 참조 금지라 그 타입을 import하지 않고, 테스트에서 호환을 검사한다.

const wonAmount = (error: string) =>
  z
    .number({ error })
    .int({ error: "금액은 원 단위 정수여야 해요" })
    .nonnegative({ error: "금액은 0원 이상이어야 해요" });

// 날짜 입력칸이 빠지면 null(이전 없음)로 채우지 않고 오류로 둔다.
const ownershipChangeDate = z
  .date({ error: "소유권 이전 등기일을 입력하거나 '소유권 이전 없음'을 골라 주세요" })
  .nullable();

export const rightsInputSchema = z.object({
  maxClaimAmount: wonAmount("근저당 채권최고액 합계를 입력해 주세요"), // 원
  seniorDeposits: wonAmount("선순위 임차보증금 합계를 입력해 주세요. 없으면 0을 입력해요"), // 원
  isTrust: z.boolean({ error: "신탁 등기 여부를 골라 주세요" }),
  lastOwnershipChangeDate: ownershipChangeDate, // 없으면 null
});

const FUTURE_DATE_ERROR = "오늘 이후 날짜는 입력할 수 없어요";

/**
 * 기준일(`asOf`)을 받아 권리관계 입력을 검증한다. 소유권 이전일이 기준일보다 뒤면 오류다.
 * 날짜 입력은 UTC 자정 Date로 들어오므로 UTC 날짜를, 기준일은 사용자가 보는 로컬 날짜를 비교한다.
 */
export function validateRightsInput(input: unknown, asOf: Date) {
  const lastDay = Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  return rightsInputSchema
    .extend({
      lastOwnershipChangeDate: ownershipChangeDate.refine((date) => date === null || utcDay(date) <= lastDay, {
        error: FUTURE_DATE_ERROR,
      }),
    })
    .safeParse(input);
}

function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
