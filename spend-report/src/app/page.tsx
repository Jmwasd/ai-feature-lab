"use client";

import { useState } from "react";

import CategoryTable from "../components/CategoryTable";
import FindingsSection from "../components/FindingsSection";
import FooterNote from "../components/FooterNote";
import Landing from "../components/Landing";
import ReportHeader from "../components/ReportHeader";
import SummaryStrip from "../components/SummaryStrip";
import type { Report } from "../types/report";

interface AnalyzeResponse {
  report: Report;
  summary: string | null;
}

const XLSX_GUIDANCE =
  "토스뱅크 원본 .xlsx는 암호화된 파일이라 바로 분석할 수 없습니다. 위 3단계에 따라 CSV로 내보낸 뒤 올려 주세요.";

export default function Home() {
  const [report, setReport] = useState<Report | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleUpload(file: File): Promise<void> {
    if (file.name.toLowerCase().endsWith(".xlsx")) {
      setError(XLSX_GUIDANCE);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/analyze", { method: "POST", body: formData });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(responseError(payload));
      }

      if (!isAnalyzeResponse(payload)) {
        throw new Error("분석 결과를 읽을 수 없습니다. CSV 파일을 다시 확인해 주세요.");
      }

      setReport(payload.report);
      setSummary(payload.summary);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "파일 분석 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
    }
  }

  function resetReport(): void {
    setReport(null);
    setSummary(null);
    setError(null);
  }

  function printReport(): void {
    window.print();
  }

  if (!report) {
    return (
      <Landing
        isUploading={isUploading}
        error={error}
        onUpload={handleUpload}
        onXlsxSelected={() => setError(XLSX_GUIDANCE)}
      />
    );
  }

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-14 pb-24">
      <ReportHeader report={report} onReset={resetReport} onPrint={printReport} />
      <SummaryStrip report={report} />
      <FindingsSection report={report} />
      {summary ? (
        <section className="mt-8 rounded-3xl border border-line p-8" aria-labelledby="summary-title">
          <p className="text-[13px] font-semibold tracking-[0.4px] text-text-muted">AI SUMMARY</p>
          <h2 id="summary-title" className="mt-3 text-xl font-semibold text-ink">
            AI 요약
          </h2>
          <div className="mt-4 space-y-3 text-[15px] leading-6 text-text-body">
            {summary.split("\n").filter(Boolean).map((line, index) => (
              <p key={`${line}-${index}`}>{line}</p>
            ))}
          </div>
        </section>
      ) : null}
      <CategoryTable report={report} />
      <FooterNote report={report} onPrint={printReport} />
    </main>
  );
}

function isAnalyzeResponse(value: unknown): value is AnalyzeResponse {
  if (!isRecord(value) || !isRecord(value.report)) {
    return false;
  }

  return value.summary === null || typeof value.summary === "string";
}

function responseError(value: unknown): string {
  return isRecord(value) && typeof value.error === "string"
    ? value.error
    : "파일 분석 중 오류가 발생했습니다.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
