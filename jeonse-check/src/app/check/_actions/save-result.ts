"use server";

import { SERIALIZED_VIEW_VERSION } from "@/features/judgment/serialize";
import { auth } from "@/server/auth";
import { createPrismaSavedResultRepository } from "@/server/saved/prisma-repository";
import { SavedLimitExceededError } from "@/server/saved/repository";
import { verifyResultToken } from "@/server/saved/result-token";

// 결과 저장 액션. 클라이언트가 보낸 판정 결과를 믿지 않는다. 조작된 결과(신호 0개 등)가 "저장된 판정"으로 남으면 안 된다.
//
// 방식: 서명 토큰. runCheckAction이 판정에 성공하면 서버가 만든 결과·입력을 사용자 id·유효 시간과 함께
// RESULT_SIGNING_SECRET으로 서명해 돌려주고(result-token.ts), 여기서는 서명이 맞는 값만 저장한다.
// 저장 시 서버에서 판정을 다시 실행하는 방식을 고르지 않은 이유:
//  - 주소 재조회(juso)·공시가격·건축물대장은 캐시가 없어 저장할 때마다 외부 호출이 세 번 더 든다(캐시는 실거래가만 있다).
//  - 다시 실행하면 그사이 수집된 거래나 날짜 차이로 화면에서 본 결과와 다른 결과가 저장될 수 있다.
//  - 호출 한도에 걸리면 결과를 보고도 저장하지 못한다.

export type SaveResultError = "unauthorized" | "invalid" | "limit" | "failed";
export type SaveResultResult = { ok: true; id: string } | { ok: false; error: SaveResultError };

/** payload는 { token }이다. token은 runCheckAction이 돌려준 saveToken이다. */
export async function saveResultAction(payload: unknown): Promise<SaveResultResult> {
  // Server Action은 공개 엔드포인트로 호출될 수 있어 세션을 다시 확인한다(ADR-002).
  const session = await auth();
  if (!session) return { ok: false, error: "unauthorized" };
  const userId = session.user.id;

  const token = isRecord(payload) ? payload.token : undefined;
  let data: ReturnType<typeof verifyResultToken>;
  try {
    data = verifyResultToken(token, userId);
  } catch (error) {
    // 서명 비밀값 설정 오류. 서버 로그에만 남긴다.
    console.error("[saveResultAction] 저장 토큰 검증 실패", error);
    return { ok: false, error: "failed" };
  }
  if (!data) return { ok: false, error: "invalid" };

  const dataBaseDate = readDataBaseDate(data.result);
  if (!dataBaseDate) return { ok: false, error: "invalid" };

  try {
    const { id } = await createPrismaSavedResultRepository().create(userId, {
      input: data.input,
      result: data.result,
      dataBaseDate,
    });
    return { ok: true, id };
  } catch (error) {
    if (error instanceof SavedLimitExceededError) return { ok: false, error: "limit" };
    // 원본 예외에는 연결 문자열 같은 내부 정보가 담길 수 있다. 서버 로그에만 남긴다.
    console.error("[saveResultAction] 저장 실패", error);
    return { ok: false, error: "failed" };
  }
}

// 서명된 결과라도 지금 읽을 수 있는 직렬화 형식(SerializedJudgmentView)인지 확인하고 기준일을 꺼낸다.
function readDataBaseDate(result: unknown): Date | null {
  if (!isRecord(result) || result.version !== SERIALIZED_VIEW_VERSION || !isRecord(result.report)) return null;
  const { dataBaseDate } = result.report;
  if (typeof dataBaseDate !== "string") return null;
  const date = new Date(dataBaseDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
