"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/Button";
import type { DeleteResultError, DeleteResultResult } from "../../_actions/delete-result";

// 저장 결과 삭제 버튼과 확인 대화상자. 확인한 뒤에만 지운다. 지우면 액션이 목록으로 이동시킨다.
// 대화상자는 scrim 배경 위 흰 카드(shadow-float)다. 레드 버튼은 대화상자의 "지우기" 하나뿐이다(UI_GUIDE §1).

const DELETE_ERROR_COPY: Record<DeleteResultError, string> = {
  unauthorized: "로그인이 끝나서 지우지 못했어요. 다시 로그인해 주세요",
  "not-found": "이미 지워졌거나 찾을 수 없는 결과예요",
  failed: "지우지 못했어요. 잠시 뒤 다시 눌러 주세요",
};

type DeleteResultButtonProps = {
  id: string;
  deleteResult: (id: string) => Promise<DeleteResultResult>;
};

export function DeleteResultButton({ id, deleteResult }: DeleteResultButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<DeleteResultError | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  // 대화상자를 닫으면 초점을 연 버튼으로 돌려준다.
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    // 첫 버튼("취소")에 초점을 둔다. 되돌릴 수 없는 동작이 기본 초점이 되지 않게 한다.
    dialogRef.current?.querySelector("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      openerRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function close() {
    setOpen(false);
    openerRef.current?.focus();
  }

  function confirm() {
    startTransition(async () => {
      // 성공하면 redirect로 이동하므로 돌아오는 값은 실패뿐이다.
      const result = await deleteSafely(deleteResult, id);
      if (result) {
        setOpen(false);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-sm">
      <Button
        variant="secondary"
        onClick={(event) => {
          openerRef.current = event.currentTarget;
          setError(null);
          setOpen(true);
        }}
      >
        삭제
      </Button>
      {error !== null ? (
        <p role="alert" className="text-body-sm text-error-text">
          {DELETE_ERROR_COPY[error]}
        </p>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-scrim px-gutter">
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="flex w-full max-w-detail flex-col gap-base rounded-card bg-canvas p-lg shadow-float"
          >
            <h2 id={titleId} className="text-title-md text-ink">
              저장한 결과를 지울까요?
            </h2>
            <p id={descriptionId} className="text-body-sm text-body">
              지운 결과는 되돌릴 수 없어요. 같은 조건을 다시 보려면 새로 조회해야 해요
            </p>
            <div className="flex flex-wrap justify-end gap-sm">
              <Button variant="secondary" onClick={close} disabled={pending}>
                취소
              </Button>
              <Button onClick={confirm} disabled={pending} aria-busy={pending}>
                지우기
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// 호출 예외(네트워크 등)는 원인을 보이지 않고 failed로 둔다. redirect 예외는 Next가 처리하도록 다시 던진다.
async function deleteSafely(
  deleteResult: DeleteResultButtonProps["deleteResult"],
  id: string,
): Promise<DeleteResultResult | undefined> {
  try {
    return await deleteResult(id);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { ok: false, error: "failed" };
  }
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}
