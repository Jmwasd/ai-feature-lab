"use server";

import type { AddressCandidate } from "@/features/lookup-input/schema";
import { auth } from "@/server/auth";
import { type NormalizedAddress, searchAddress } from "@/server/public-data/juso";

// 주소 API로 보내는 검색어 상한. 명세의 "검색어 너무 김"(E0010)보다 먼저 막는다.
const MAX_KEYWORD_LENGTH = 100;

export type SearchAddressResult =
  | { ok: true; candidates: AddressCandidate[] }
  | { ok: false; error: "unauthorized" | "invalid" | "unavailable" };

// Server Action은 공개 엔드포인트로 호출될 수 있어 세션을 다시 확인한다(ADR-002).
// 오류는 코드로만 돌려준다. 원본 예외에는 요청 URL 같은 내부 정보가 담길 수 있다.
export async function searchAddressAction(keyword: string): Promise<SearchAddressResult> {
  const session = await auth();
  if (!session) return { ok: false, error: "unauthorized" };

  if (typeof keyword !== "string") return { ok: false, error: "invalid" };
  const trimmed = keyword.trim();
  if (trimmed === "" || trimmed.length > MAX_KEYWORD_LENGTH) return { ok: false, error: "invalid" };

  try {
    const addresses = await searchAddress(trimmed);
    return { ok: true, candidates: addresses.map(toCandidate) };
  } catch (error) {
    console.error("[searchAddressAction] 주소 검색 실패", error);
    return { ok: false, error: "unavailable" };
  }
}

// 화면에 필요한 필드만 내보낸다. PNU·지번 분해값은 판정 실행 시 서버가 다시 조회한다.
function toCandidate(address: NormalizedAddress): AddressCandidate {
  return {
    id: address.id,
    roadAddress: address.roadAddress,
    jibunAddress: address.jibunAddress,
    buildingName: address.buildingName,
    admCd: address.admCd,
  };
}
