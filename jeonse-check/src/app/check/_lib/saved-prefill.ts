import { z } from "zod";
import { HOUSE_TYPES, type LookupInput } from "@/features/lookup-input/schema";
import type { RightsFormValue } from "@/features/rights-input/RightsForm";

// 저장한 결과의 입력으로 조회 폼을 미리 채운다("같은 조건으로 다시 조회").
// 주소는 건물관리번호를 저장하지 않으므로 검색어로만 채우고, 사용자가 검색해 다시 고른다.
// 형식이 맞지 않으면 추측해서 채우지 않고 null을 돌려준다(빈 폼으로 시작).

export type CheckPrefill = {
  addressKeyword: string;
  lookup: Omit<LookupInput, "address">;
  rights: RightsFormValue;
};

const savedInputSchema = z.object({
  address: z.object({ display: z.string().min(1), dong: z.string().optional(), ho: z.string().optional() }),
  houseType: z.enum(HOUSE_TYPES),
  deposit: z.number().int().positive(),
  exclusiveArea: z.number().positive(),
  rights: z.object({
    maxClaimAmount: z.number().int().nonnegative(),
    seniorDeposits: z.number().int().nonnegative(),
    isTrust: z.boolean(),
    lastOwnershipChangeDate: z.iso.datetime().nullable(),
  }),
});

export function readSavedPrefill(input: unknown): CheckPrefill | null {
  const parsed = savedInputSchema.safeParse(input);
  if (!parsed.success) return null;
  const { address, rights, ...rest } = parsed.data;
  return {
    addressKeyword: address.display,
    lookup: {
      ...rest,
      ...(address.dong === undefined ? {} : { dong: address.dong }),
      ...(address.ho === undefined ? {} : { ho: address.ho }),
    },
    rights: {
      ...rights,
      lastOwnershipChangeDate: rights.lastOwnershipChangeDate === null ? null : new Date(rights.lastOwnershipChangeDate),
    },
  };
}
