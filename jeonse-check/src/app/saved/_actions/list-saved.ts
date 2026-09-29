"use server";

import { auth } from "@/server/auth";
import { createPrismaSavedResultRepository } from "@/server/saved/prisma-repository";
import { SAVED_PAGE_SIZE, type SavedPage, toSavedPage } from "../_lib/saved-list";

export type LoadMoreSavedResult = { ok: true; page: SavedPage } | { ok: false; error: "unauthorized" | "failed" };

/** 저장 목록 "더 보기". cursor는 앞 페이지의 nextCursor다. 다른 사용자의 id를 주면 빈 페이지다(저장소 계약). */
export async function loadMoreSavedAction(cursor: unknown): Promise<LoadMoreSavedResult> {
  // Server Action은 공개 엔드포인트로 호출될 수 있어 세션을 다시 확인한다(ADR-002).
  const session = await auth();
  if (!session) return { ok: false, error: "unauthorized" };
  if (typeof cursor !== "string" || cursor === "") return { ok: false, error: "failed" };

  try {
    const page = await createPrismaSavedResultRepository().listByUser(session.user.id, { cursor, limit: SAVED_PAGE_SIZE });
    return { ok: true, page: toSavedPage(page) };
  } catch (error) {
    // 원본 예외에는 연결 문자열 같은 내부 정보가 담길 수 있다. 서버 로그에만 남긴다.
    console.error("[loadMoreSavedAction] 목록 조회 실패", error);
    return { ok: false, error: "failed" };
  }
}
