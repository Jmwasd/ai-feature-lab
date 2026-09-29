"use server";

import { runJudgment } from "@/features/judgment/run";
import { type SerializedJudgmentView, serializeJudgmentView } from "@/features/judgment/serialize";
import { HOUSE_TYPES, type HouseType, lookupInputSchema } from "@/features/lookup-input/schema";
import { validateRightsInput } from "@/features/rights-input/schema";
import { auth } from "@/server/auth";
import { collectPublicInputs, LookupFailedError } from "@/server/lookup/collect-inputs";
import { defaultLookupDeps } from "@/server/lookup/default-deps";
import { PublicDataError } from "@/server/public-data/http";
import { searchAddress } from "@/server/public-data/juso";
import type { TradeHouseType } from "@/server/public-data/molit-trade";

// 주소 재조회 때 받는 결과 수. 같은 도로명주소에 건물이 여러 개(단지)여도 선택한 건물을 찾을 수 있게 넉넉히 받는다.
const RELOOKUP_PER_PAGE = 20;

const TRADE_HOUSE_TYPE: Record<HouseType, TradeHouseType> = {
  apartment: "APARTMENT",
  "row-house": "ROW_HOUSE",
};

export type CheckError =
  | "unauthorized"
  | "invalid-input"
  | "address-not-found"
  | "unsupported-house"
  | "lookup-failed"
  | "quota";

export type RunCheckResult = { ok: true; view: SerializedJudgmentView } | { ok: false; error: CheckError };

/**
 * 조회 조건과 권리 입력으로 공공데이터를 모아 판정한다. payload는 { lookup, rights }다.
 * 클라이언트 검증을 믿지 않고 서버에서 다시 검증하며, 주소는 건물관리번호로 서버에서 다시 조회한 결과만 쓴다.
 * 오류는 CheckError 코드로만 돌려준다. 원본 예외에는 요청 URL 같은 내부 정보가 담길 수 있다.
 */
export async function runCheckAction(payload: unknown): Promise<RunCheckResult> {
  // Server Action은 공개 엔드포인트로 호출될 수 있어 세션을 다시 확인한다(ADR-002).
  const session = await auth();
  if (!session) return { ok: false, error: "unauthorized" };

  const lookupPayload = isRecord(payload) ? payload.lookup : undefined;
  if (isUnsupportedHouseType(lookupPayload)) return { ok: false, error: "unsupported-house" };

  const asOf = new Date();
  const lookupParsed = lookupInputSchema.safeParse(lookupPayload);
  const rightsParsed = validateRightsInput(isRecord(payload) ? payload.rights : undefined, asOf);
  if (!lookupParsed.success || !rightsParsed.success) return { ok: false, error: "invalid-input" };
  const lookup = lookupParsed.data;

  try {
    // 클라이언트가 보낸 admCd는 쓰지 않는다. 조작된 법정동코드로 다른 지역 판정이 나오면 안 된다.
    const found = await searchAddress(lookup.address.roadAddress, { perPage: RELOOKUP_PER_PAGE });
    const address = found.find((candidate) => candidate.id === lookup.address.id);
    if (!address) return { ok: false, error: "address-not-found" };

    const publicData = await collectPublicInputs(
      {
        address,
        houseType: TRADE_HOUSE_TYPE[lookup.houseType],
        exclusiveArea: lookup.exclusiveArea,
        dong: lookup.dong ?? null,
        ho: lookup.ho ?? null,
      },
      defaultLookupDeps(),
      asOf,
    );

    const view = runJudgment({
      address: { display: address.roadAddress, admCd: address.admCd, dong: lookup.dong, ho: lookup.ho },
      deposit: lookup.deposit,
      exclusiveArea: lookup.exclusiveArea,
      rights: rightsParsed.data,
      publicData,
      asOf,
    });
    return { ok: true, view: serializeJudgmentView(view) };
  } catch (error) {
    return { ok: false, error: toCheckError(error) };
  }
}

// 주택 유형 값이 있지만 MVP 범위(아파트·연립다세대)가 아니면 입력 오류와 구분해 알린다.
function isUnsupportedHouseType(lookup: unknown): boolean {
  if (!isRecord(lookup)) return false;
  const { houseType } = lookup;
  return typeof houseType === "string" && houseType !== "" && !(HOUSE_TYPES as readonly string[]).includes(houseType);
}

function toCheckError(error: unknown): CheckError {
  if (error instanceof PublicDataError) return error.kind === "quota" ? "quota" : "lookup-failed";
  if (error instanceof LookupFailedError) {
    return error.warnings.some((warning) => warning.kind === "trades-quota") ? "quota" : "lookup-failed";
  }
  // 환경변수 누락·버그 같은 예상 못 한 예외. 서버 로그에만 남긴다.
  console.error("[runCheckAction] 판정 실행 실패", error);
  return "lookup-failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
