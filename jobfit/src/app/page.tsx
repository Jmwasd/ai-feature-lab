"use client";

import { useState } from "react";
import { PostingInput } from "@/components/PostingInput";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { ResultSection } from "@/components/ResultSection";
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
  // 고지 문구는 첫 결과가 나올 때까지 보인다. 로딩 중에는 버튼 라벨 말고 아무것도 바뀌지 않는다
  const [hasShownResult, setHasShownResult] = useState(false);

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

    setResult(undefined);
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
        setHasShownResult(true);
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
        {hasShownResult ? null : <PrivacyNotice />}
      </section>

      {viewState === "result" && result ? (
        <ResultSection response={result} />
      ) : null}
    </main>
  );
}
