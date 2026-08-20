"use client";

import { useMemo, useRef, useState } from "react";

import CategoryTable from "../components/CategoryTable";
import FindingsSection from "../components/FindingsSection";
import FooterNote from "../components/FooterNote";
import Landing from "../components/Landing";
import ReportHeader from "../components/ReportHeader";
import SummaryStrip from "../components/SummaryStrip";
import { analyze } from "../lib/analyze";
import type { Category, Override } from "../types/report";
import type { Transaction } from "../types/transaction";
import { formatPeriod } from "../components/format";

interface AnalyzeResponse {
  transactions: Transaction[];
  queryPeriod: { from: Date; to: Date } | null;
  llmCategories: Record<string, Category>;
  summary: string | null;
}

const XLSX_GUIDANCE =
  "토스뱅크 원본 .xlsx는 암호화된 파일이라 바로 분석할 수 없습니다. 위 3단계에 따라 CSV로 내보낸 뒤 올려 주세요.";

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const queryPeriodRef = useRef<{ from: Date; to: Date } | null>(null);
  const llmCategoriesRef = useRef<Record<string, Category>>({});
  const reportGeneratedAtRef = useRef<Date | null>(null);
  const report = useMemo(
    () =>
      transactions.length > 0
        ? analyze(transactions, {
            queryPeriod: queryPeriodRef.current,
            llmCategories: llmCategoriesRef.current,
            overrides,
          })
        : null,
    [transactions, overrides],
  );

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

      const analyzed = parseAnalyzeResponse(payload);

      if (!analyzed) {
        throw new Error("분석 결과를 읽을 수 없습니다. CSV 파일을 다시 확인해 주세요.");
      }

      queryPeriodRef.current = analyzed.queryPeriod;
      llmCategoriesRef.current = analyzed.llmCategories;
      reportGeneratedAtRef.current = new Date();
      setTransactions(analyzed.transactions);
      setOverrides({});
      setSummary(analyzed.summary);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "파일 분석 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
    }
  }

  function resetReport(): void {
    setTransactions([]);
    setOverrides({});
    queryPeriodRef.current = null;
    llmCategoriesRef.current = {};
    reportGeneratedAtRef.current = null;
    setSummary(null);
    setError(null);
  }

  function updateOverride(id: string, override: Override): void {
    setOverrides((current) => {
      if (!override.category && !override.excluded) {
        const { [id]: _discarded, ...remaining } = current;
        return remaining;
      }

      return { ...current, [id]: override };
    });
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
      <p className="print-only mb-8 border-b border-line pb-4 text-[13px] text-text-body">
        리포트 기간 · {formatPeriod(report.period.from, report.period.to)} · 생성 {formatPrintTimestamp(reportGeneratedAtRef.current ?? new Date())}
      </p>
      <ReportHeader report={report} onReset={resetReport} onPrint={printReport} />
      <SummaryStrip report={report} />
      <FindingsSection report={report} overrides={overrides} onOverrideChange={updateOverride} />
      {summary && Object.keys(overrides).length === 0 ? (
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

function formatPrintTimestamp(value: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function parseAnalyzeResponse(value: unknown): AnalyzeResponse | null {
  if (
    !isRecord(value) ||
    !isRecord(value.report) ||
    !Array.isArray(value.transactions) ||
    !isRecord(value.llmCategories) ||
    (value.summary !== null && typeof value.summary !== "string")
  ) {
    return null;
  }

  const transactions: Transaction[] = [];

  for (const rawTransaction of value.transactions) {
    const transaction = parseTransaction(rawTransaction);

    if (!transaction) {
      return null;
    }

    transactions.push(transaction);
  }

  const llmCategories = parseLlmCategories(value.llmCategories);

  if (!llmCategories) {
    return null;
  }

  return {
    transactions,
    queryPeriod: parseDateRange(value.queryPeriod),
    llmCategories,
    summary: value.summary,
  };
}

function parseTransaction(value: unknown): Transaction | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.description !== "string" ||
    typeof value.kind !== "string" ||
    typeof value.amount !== "number" ||
    typeof value.memo !== "string" ||
    typeof value.balanceAfter !== "number"
  ) {
    return null;
  }

  const at = parseDate(value.at);
  return at
    ? {
        id: value.id,
        at,
        description: value.description,
        kind: value.kind,
        amount: value.amount,
        memo: value.memo,
        balanceAfter: value.balanceAfter,
      }
    : null;
}

function parseDateRange(value: unknown): { from: Date; to: Date } | null {
  if (!isRecord(value)) {
    return null;
  }

  const from = parseDate(value.from);
  const to = parseDate(value.to);
  return from && to ? { from, to } : null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseLlmCategories(value: Record<string, unknown>): Record<string, Category> | null {
  const entries = Object.entries(value);

  if (!entries.every(([, category]) => isCategory(category))) {
    return null;
  }

  return Object.fromEntries(entries) as Record<string, Category>;
}

function isCategory(value: unknown): value is Category {
  return (
    value === "식비" ||
    value === "카페" ||
    value === "배달" ||
    value === "식료품" ||
    value === "생활" ||
    value === "교통" ||
    value === "숙박" ||
    value === "문화" ||
    value === "의료" ||
    value === "수수료/기타" ||
    value === "미분류"
  );
}

function responseError(value: unknown): string {
  return isRecord(value) && typeof value.error === "string"
    ? value.error
    : "파일 분석 중 오류가 발생했습니다.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
