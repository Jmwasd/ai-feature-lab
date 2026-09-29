import { z } from "zod";

// 조회 조건 입력 스키마. 클라이언트 폼 검증과 Server Action 검증에 같은 스키마를 쓴다.

// MVP 주택 유형(PRD). judgment feature를 참조하지 않도록 이 feature 안에서 다시 정의한다.
export const HOUSE_TYPES = ["apartment", "row-house"] as const;
export type HouseType = (typeof HOUSE_TYPES)[number];

export const HOUSE_TYPE_LABEL: Record<HouseType, string> = {
  apartment: "아파트",
  "row-house": "연립다세대",
};

const ADDRESS_ERROR = "주소를 검색해서 목록에서 골라 주세요";

// 후보 안쪽 필드 오류도 사용자에게는 같은 문구로 보인다.
const addressError = { error: ADDRESS_ERROR };

export const addressCandidateSchema = z.object(
  {
    id: z.string(addressError).min(1, addressError),
    roadAddress: z.string(addressError).min(1, addressError),
    jibunAddress: z.string(addressError),
    buildingName: z.string(addressError).nullable(),
    admCd: z.string(addressError).regex(/^\d{10}$/, addressError), // 법정동코드 10자리
  },
  addressError,
);

// 빈 문자열은 입력하지 않은 것으로 본다.
const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(20, { error: "20자 이내로 입력해 주세요" }).optional(),
);

export const lookupInputSchema = z.object({
  address: addressCandidateSchema,
  houseType: z.enum(HOUSE_TYPES, { error: "주택 유형을 골라 주세요" }),
  deposit: z
    .number({ error: "보증금을 이해하지 못했어요. 예: 2억 8000만, 28000(만원)" })
    .int({ error: "보증금은 원 단위 정수여야 해요" })
    .positive({ error: "보증금은 0원보다 커야 해요" }),
  exclusiveArea: z
    .number({ error: "전용면적을 숫자로 입력해 주세요. 예: 59.8" })
    .positive({ error: "전용면적은 0보다 커야 해요" }),
  dong: optionalText, // 공시가격 조회용
  ho: optionalText,
});

export interface AddressCandidate {
  id: string; // 검색 결과 내 식별자
  roadAddress: string;
  jibunAddress: string;
  buildingName: string | null;
  admCd: string; // 법정동코드 10자리
}

export type LookupInput = {
  address: AddressCandidate; // 주소 검색에서 고른 항목
  houseType: HouseType;
  deposit: number; // 원, 양의 정수
  exclusiveArea: number; // ㎡, 0 초과
  dong?: string; // 동 (공시가격 조회용, 선택)
  ho?: string; // 호 (공시가격 조회용, 선택)
};

// 스키마 출력과 선언한 타입이 어긋나면 컴파일 오류가 나게 한다.
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const schemaMatchesType: Equals<z.output<typeof lookupInputSchema>, LookupInput> = true;
void schemaMatchesType;
