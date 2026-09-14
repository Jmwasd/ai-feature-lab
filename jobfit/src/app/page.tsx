"use client";

import { useState } from "react";
import { PostingInput } from "@/components/PostingInput";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import type { AnalyzeRequest, AnalyzeResponse } from "@/types/api";

type ViewState = "idle" | "loading" | "result" | "needsPaste" | "error";
type SuccessfulAnalyzeResponse = Extract<AnalyzeResponse, { status: "ok" }>;

const NETWORK_ERROR_MESSAGE = "분석 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.";

export default function Home() {
  const [viewState, setViewState] = useState<ViewState>("idle");
  const [url, setUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [message, setMessage] = useState<string>();
  const [result, setResult] = useState<SuccessfulAnalyzeResponse>();

  async function analyze() {
    if (viewState === "loading") {
      return;
    }

    const hasPastedText = pasteOpen && pastedText.trim().length > 0;
    const trimmedUrl = url.trim();

    if (!hasPastedText && trimmedUrl.length === 0) {
      return;
    }

    const requestBody: AnalyzeRequest = hasPastedText
      ? { text: pastedText }
      : { url: trimmedUrl };

    setViewState("loading");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = (await response.json()) as AnalyzeResponse;

      if (data.status === "ok") {
        setResult(data);
        setMessage(undefined);
        setViewState("result");
        return;
      }

      setMessage(data.message);

      if (data.status === "needs-paste") {
        setPasteOpen(true);
        setViewState("needsPaste");
        return;
      }

      setViewState("error");
    } catch {
      setMessage(NETWORK_ERROR_MESSAGE);
      setViewState("error");
    }
  }

  const visibleMessage =
    viewState === "needsPaste" || viewState === "error" ? message : undefined;

  return (
    <main className="mx-auto max-w-[1180px] px-6 pt-10 pb-20">
      <section className="flex max-w-[720px] flex-col gap-6">
        <PostingInput
          url={url}
          pastedText={pastedText}
          pasteOpen={pasteOpen}
          isLoading={viewState === "loading"}
          message={visibleMessage}
          onUrlChange={setUrl}
          onPastedTextChange={setPastedText}
          onPasteToggle={() => setPasteOpen((isOpen) => !isOpen)}
          onSubmit={analyze}
        />
        {result ? null : <PrivacyNotice />}
      </section>

      {viewState === "result" && result ? (
        <>
          {/* 임시: 3-result-ui phase의 result-page step에서 3분할 결과 섹션으로 교체한다 */}
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </>
      ) : null}
    </main>
  );
}
