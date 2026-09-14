import type { AnalysisResult } from "@/types";

export interface AnalyzeRequest {
  url?: string;
  text?: string;
}

export type AnalyzeResponse =
  | {
      status: "ok";
      posting: { title: string; sourceUrl?: string };
      requirementCount: number;
      result: AnalysisResult;
    }
  | { status: "needs-paste"; message: string }
  | { status: "error"; message: string };
