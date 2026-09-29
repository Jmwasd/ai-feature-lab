import { describe, expect, it } from "vitest";
import { readSavedPrefill } from "./saved-prefill";

// runCheckAction이 저장 토큰에 싣는 input 형식(save-result.test.ts 참고)
const SAVED_INPUT = {
  address: { display: "서울특별시 마포구 망원로 1", dong: "1동", ho: "201호" },
  houseType: "row-house",
  deposit: 150_000_000,
  exclusiveArea: 59.8,
  rights: { maxClaimAmount: 60_000_000, seniorDeposits: 0, isTrust: false, lastOwnershipChangeDate: "2020-05-01T00:00:00.000Z" },
};

describe("readSavedPrefill", () => {
  it("저장된 입력을 조회 폼 기본값으로 바꾼다", () => {
    expect(readSavedPrefill(SAVED_INPUT)).toEqual({
      addressKeyword: "서울특별시 마포구 망원로 1",
      lookup: { houseType: "row-house", deposit: 150_000_000, exclusiveArea: 59.8, dong: "1동", ho: "201호" },
      rights: {
        maxClaimAmount: 60_000_000,
        seniorDeposits: 0,
        isTrust: false,
        lastOwnershipChangeDate: new Date("2020-05-01T00:00:00.000Z"),
      },
    });
  });

  it("동·호가 없고 소유권 이전이 없으면 그대로 비워 둔다", () => {
    const prefill = readSavedPrefill({
      ...SAVED_INPUT,
      address: { display: "서울특별시 마포구 망원로 1" },
      rights: { ...SAVED_INPUT.rights, lastOwnershipChangeDate: null },
    });

    expect(prefill?.lookup).toEqual({ houseType: "row-house", deposit: 150_000_000, exclusiveArea: 59.8 });
    expect(prefill?.rights.lastOwnershipChangeDate).toBeNull();
  });

  it.each([
    ["null", null],
    ["주소 없음", { ...SAVED_INPUT, address: {} }],
    ["MVP 밖 주택 유형", { ...SAVED_INPUT, houseType: "officetel" }],
    ["보증금이 문자열", { ...SAVED_INPUT, deposit: "1억" }],
    ["날짜 형식 오류", { ...SAVED_INPUT, rights: { ...SAVED_INPUT.rights, lastOwnershipChangeDate: "어제" } }],
  ])("%s이면 추측하지 않고 null", (_name, input) => {
    expect(readSavedPrefill(input)).toBeNull();
  });
});
