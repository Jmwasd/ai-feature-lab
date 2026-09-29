"use client";

import { Button } from "@/components/Button";
import { ROUTE_ERROR_COPY } from "./_components/error-copy";

type CheckRouteErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
  reset: () => void;
};

// /check의 예상 못 한 예외 경계. error.message·stack·digest는 화면에 내보내지 않는다(요청 URL·서비스키가 담길 수 있다).
// 다시 시도는 사용자가 누를 때만 한다. 자동 재시도는 호출 한도를 더 쓴다.
export default function CheckRouteError({ retry }: CheckRouteErrorProps) {
  return (
    <main className="mx-auto flex w-full max-w-editorial flex-col items-start gap-base px-gutter py-section">
      <h1 className="text-display-xl text-ink">{ROUTE_ERROR_COPY.title}</h1>
      <p className="max-w-detail text-body-md text-body">{ROUTE_ERROR_COPY.description}</p>
      <Button onClick={() => retry()}>{ROUTE_ERROR_COPY.action}</Button>
    </main>
  );
}
