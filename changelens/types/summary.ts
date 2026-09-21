export type SummaryResult =
  | { status: "ok"; summary: string; points: string[]; truncated: boolean }
  | { status: "disabled" }
  | { status: "error"; reason: "auth" | "rate-limit" | "refusal" | "failed" };
