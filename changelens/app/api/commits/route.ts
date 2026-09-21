import { NextResponse } from "next/server";
import { GitError, listCommits, resolveRepoPath } from "@/lib/git";
import type { CommitPage } from "@/types/git";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const values = new URL(request.url).searchParams.getAll("skip");
  const value = values[0] ?? "0";
  const skip = Number(value);
  if (values.length > 1 || !value || /[^0-9]/.test(value) || !Number.isSafeInteger(skip)) {
    return NextResponse.json({ error: "invalid skip" }, { status: 400 });
  }

  try {
    const commits = await listCommits(resolveRepoPath(), { skip });
    return NextResponse.json({
      commits,
      nextSkip: commits.length < 50 ? null : skip + commits.length,
    } satisfies CommitPage);
  } catch (error) {
    if (error instanceof GitError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    throw error;
  }
}
