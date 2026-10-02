"use client";

import { House } from "lucide-react";
import Image from "next/image";
import { useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";

type LoginDialogProps = {
  // Google 로그인 Server Action. Client Component가 서버 모듈을 import하지 않도록 props로 받는다.
  signIn: (formData: FormData) => Promise<void>;
};

// TopNav 오른쪽 "로그인" 버튼과 로그인 모달(UI_GUIDE §4 Modal).
export function LoginDialog({ signIn }: LoginDialogProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <>
      <Button variant="secondary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        로그인
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy={titleId} describedBy={descriptionId}>
        <div className="flex flex-col items-center gap-lg pt-sm text-center">
          <div className="flex flex-col items-center gap-sm">
            <span className="inline-flex items-center gap-sm text-display-lg leading-none text-primary">
              <House aria-hidden="true" size={24} />
              jeonse-check
            </span>
            <h2 id={titleId} className="text-display-sm text-ink">
              로그인
            </h2>
            <p id={descriptionId} className="text-body-sm text-body">
              진단 결과를 저장하고, 계약 전에 다시 확인할 수 있어요.
            </p>
          </div>
          {/* callbackUrl을 보내지 않으면 로그인 뒤 기본 경로(/check)로 간다. */}
          <form action={signIn} className="w-full">
            <GoogleSubmitButton />
          </form>
          <p className="text-caption-sm text-muted">
            계속하면 jeonse-check의 <strong className="font-semibold text-ink">이용약관</strong>과{" "}
            <strong className="font-semibold text-ink">개인정보처리방침</strong>에 동의하는 것으로 봐요.
          </p>
        </div>
      </Modal>
    </>
  );
}

// 시안의 Google 버튼은 잉크 대신 hairline 테두리라 Button 변형 대신 같은 토큰으로 조합한다.
function GoogleSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex min-h-control w-full items-center justify-center gap-sm rounded-button border border-hairline bg-canvas px-lg text-button-md text-ink transition-colors hover:bg-surface-soft active:bg-surface-strong disabled:cursor-not-allowed disabled:text-muted-soft"
    >
      <Image src="/images/google-g.svg" alt="" width={18} height={18} unoptimized />
      Google로 계속하기
    </button>
  );
}
