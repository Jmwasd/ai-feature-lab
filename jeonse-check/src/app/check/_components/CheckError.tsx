import { Button } from "@/components/Button";
import type { CheckError as CheckErrorCode } from "../_actions/run-check";
import { CHECK_ERROR_COPY } from "./error-copy";

// 로그인 뒤 조회 화면으로 돌아온다. page.tsx의 비로그인 redirect와 같은 경로다.
const LOGIN_HREF = "/?callbackUrl=/check";

type CheckErrorProps = {
  code: CheckErrorCode;
  // unauthorized 외 코드의 행동 버튼. 무엇을 할지는 흐름 상태를 가진 CheckFlow가 정한다.
  onAction: () => void;
};

// 판정 실패 화면. 결과가 없으므로 신호 개수나 "위험 신호" 헤드라인을 두지 않는다.
export function CheckError({ code, onAction }: CheckErrorProps) {
  const copy = CHECK_ERROR_COPY[code];

  return (
    <div className="mx-auto w-full max-w-editorial px-gutter py-xl">
      <section role="alert" aria-labelledby="check-error-title" className="flex flex-col items-start gap-base border-t border-hairline-soft pt-xl">
        <h2 id="check-error-title" className="text-display-sm text-ink">
          {copy.title}
        </h2>
        <p className="max-w-detail text-body-md text-body">{copy.description}</p>
        {code === "unauthorized" ? (
          <Button href={LOGIN_HREF}>{copy.action}</Button>
        ) : (
          <Button onClick={onAction}>{copy.action}</Button>
        )}
      </section>
    </div>
  );
}
