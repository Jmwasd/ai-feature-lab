"use client";

import { useEffect, useState } from "react";
import { SummaryPanel } from "@/components/ui/SummaryPanel";
import type { SummaryResult } from "@/types/summary";

export function SummaryCard({ sha }: { sha: string }) {
  const [result, setResult] = useState<SummaryResult | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setResult(null);

    async function loadSummary() {
      try {
        const response = await fetch(`/api/summary/${sha}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Summary request failed");
        const summary: SummaryResult = await response.json();
        if (!controller.signal.aborted) setResult(summary);
      } catch {
        if (!controller.signal.aborted) setResult({ status: "error", reason: "failed" });
      }
    }

    void loadSummary();
    return () => controller.abort();
  }, [sha]);

  return <SummaryPanel result={result} />;
}
