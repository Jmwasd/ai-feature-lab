"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/Button";
import type { SaveResultError, SaveResultResult } from "../_actions/save-result";

// 결과 화면의 "결과 저장" 버튼과 저장 안내. 결과 하나당 한 번만 저장한다.
// 결과 화면의 레드 CTA 개수를 늘리지 않도록 secondary 버튼을 쓴다(UI_GUIDE §1).

export const SAVE_ERROR_COPY: Record<SaveResultError, string> = {
  unauthorized: "로그인이 끝나서 저장하지 못했어요. 다시 로그인한 뒤 조회해 주세요",
  invalid: "저장할 수 있는 시간이 지났어요. 조건 바꿔 다시 보기로 다시 조회한 뒤 저장해 주세요",
  limit: "저장할 수 있는 개수를 모두 채웠어요. 저장 목록에서 지난 결과를 지운 뒤 다시 저장해 주세요",
  failed: "결과를 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요",
};

type SaveState = { status: "idle" } | { status: "saving" } | { status: "saved" } | { status: "error"; code: SaveResultError };

type SaveResultButtonProps = {
  // runCheckAction이 돌려준 saveToken. 서버 설정 오류로 없으면 null이다.
  token: string | null;
  saveResult: (payload: { token: string }) => Promise<SaveResultResult>;
};

export function SaveResultButton({ token, saveResult }: SaveResultButtonProps) {
  const [state, setState] = useState<SaveState>({ status: "idle" });
  // 비활성화가 화면에 반영되기 전에 연달아 눌러도 한 번만 호출한다.
  const inFlight = useRef(false);

  async function save() {
    if (inFlight.current || state.status === "saved") return;
    if (token === null) {
      setState({ status: "error", code: "failed" });
      return;
    }
    inFlight.current = true;
    setState({ status: "saving" });
    const result = await saveSafely(saveResult, token);
    inFlight.current = false;
    setState(result.ok ? { status: "saved" } : { status: "error", code: result.error });
  }

  const busy = state.status === "saving" || state.status === "saved";

  return (
    <div className="flex flex-col items-center gap-sm">
      <Button variant="secondary" onClick={() => void save()} disabled={busy} aria-busy={state.status === "saving"}>
        결과 저장
      </Button>
      {state.status === "saved" ? (
        <p role="status" className="text-body-sm text-body">
          저장했어요 ·{" "}
          <Button variant="tertiary-text" href="/saved">
            저장 목록 보기
          </Button>
        </p>
      ) : null}
      {state.status === "error" ? (
        <p role="alert" className="max-w-detail text-center text-body-sm text-error-text">
          {SAVE_ERROR_COPY[state.code]}
        </p>
      ) : null}
    </div>
  );
}

// 호출 예외(네트워크 등)는 원인을 보이지 않고 failed로 둔다.
async function saveSafely(saveResult: SaveResultButtonProps["saveResult"], token: string): Promise<SaveResultResult> {
  try {
    return await saveResult({ token });
  } catch {
    return { ok: false, error: "failed" };
  }
}
