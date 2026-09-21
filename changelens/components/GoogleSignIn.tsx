"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeNext } from "@/lib/auth/next";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
          renderButton(element: HTMLElement, options: {
            theme: "outline";
            size: "large";
            text: "continue_with";
            locale: "ko";
            width: number;
          }): void;
        };
      };
    };
  }
}

export function GoogleSignIn({ clientId, next }: {
  clientId: string | undefined;
  next: string | null;
}): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async ({ credential }: { credential: string }) => {
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      if (!response.ok) {
        setError("구글 계정으로 다시 로그인해 주세요.");
        return;
      }
      window.location.assign(sanitizeNext(next) ?? "/repo");
    } catch {
      setError("연결을 확인하고 다시 로그인해 주세요.");
    } finally {
      submitting.current = false;
    }
  }, [next]);

  useEffect(() => {
    const element = container.current;
    const identity = window.google?.accounts.id;
    if (!ready || !clientId || !element || !identity) return;

    identity.initialize({ client_id: clientId, callback: signIn });
    let renderedWidth = 0;
    const render = () => {
      const width = Math.floor(element.getBoundingClientRect().width);
      if (width <= 0 || width === renderedWidth) return;
      renderedWidth = width;
      element.replaceChildren();
      identity.renderButton(element, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        locale: "ko",
        width,
      });
    };
    render();
    const observer = new ResizeObserver(render);
    observer.observe(element);
    return () => {
      observer.disconnect();
      element.replaceChildren();
    };
  }, [clientId, ready, signIn]);

  if (!clientId) {
    return (
      <div className="text-left text-sm leading-[1.6] text-body-dim">
        <p>Google Cloud 콘솔에서 OAuth 클라이언트 ID를 웹 애플리케이션 유형으로 발급한다.</p>
        <p className="mt-3">승인된 JavaScript 원본에 <code className="font-mono text-[13px]">http://localhost:3000</code>과 <code className="font-mono text-[13px]">http://localhost</code>를 등록한다.</p>
        <p className="mt-3 break-words"><code className="font-mono text-[13px]">.env.local</code>의 <code className="font-mono text-[13px]">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>에 넣고 <code className="font-mono text-[13px]">npm run build</code>를 다시 실행한다.</p>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        onReady={() => setReady(true)}
        onError={() => setError("연결을 확인하고 페이지를 새로고침해 주세요.")}
      />
      <div ref={container} className="min-h-10 w-full" />
      {error && <p role="alert" className="mt-3 text-sm leading-[1.6] text-body-dim">{error}</p>}
    </>
  );
}
