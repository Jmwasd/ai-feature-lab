import { NextResponse } from "next/server";
import { CommitNotFoundError, isValidSha, resolveRepoPath } from "@/lib/git";
import { summarizeCommit } from "@/lib/summary";
import type { SummaryResult } from "@/types/summary";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ sha: string }> }) {
  const { sha } = await params;
  if (!isValidSha(sha)) return NextResponse.json({ error: "invalid sha" }, { status: 400 });
  try {
    return NextResponse.json(await summarizeCommit(resolveRepoPath(), sha));
  } catch (error) {
    if (error instanceof CommitNotFoundError) {
      return NextResponse.json({ error: "commit not found" }, { status: 404 });
    }
    return NextResponse.json({ status: "error", reason: "failed" } satisfies SummaryResult);
  }
}
