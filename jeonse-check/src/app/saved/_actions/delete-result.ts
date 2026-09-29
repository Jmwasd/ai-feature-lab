"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { createPrismaSavedResultRepository } from "@/server/saved/prisma-repository";

// 저장 결과 삭제. 다른 사용자의 id는 없는 id와 똑같이 not-found로 돌려준다(존재 여부를 드러내지 않는다).
// 지우면 목록으로 이동하므로 성공 값은 돌려주지 않는다.

export type DeleteResultError = "unauthorized" | "not-found" | "failed";
export type DeleteResultResult = { ok: false; error: DeleteResultError };

export async function deleteResultAction(id: unknown): Promise<DeleteResultResult> {
  // Server Action은 공개 엔드포인트로 호출될 수 있어 세션을 다시 확인한다(ADR-002).
  const session = await auth();
  if (!session) return { ok: false, error: "unauthorized" };
  if (typeof id !== "string" || id === "") return { ok: false, error: "not-found" };

  let deleted: boolean;
  try {
    deleted = await createPrismaSavedResultRepository().deleteForUser(session.user.id, id);
  } catch (error) {
    // 원본 예외에는 연결 문자열 같은 내부 정보가 담길 수 있다. 서버 로그에만 남긴다.
    console.error("[deleteResultAction] 삭제 실패", error);
    return { ok: false, error: "failed" };
  }
  if (!deleted) return { ok: false, error: "not-found" };

  revalidatePath("/saved");
  redirect("/saved");
}
