import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { RepoStatus } from "@/types/git";
import { GitError, GitNotInstalledError, runGit } from "./run";

export async function getRepoStatus(repoPath: string): Promise<RepoStatus> {
  const path = resolve(repoPath);
  try {
    if (!(await stat(path)).isDirectory()) return { kind: "not-repo", path };
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) {
      return { kind: "not-repo", path };
    }
    throw error;
  }
  try {
    await runGit(path, ["rev-parse", "--git-dir"]);
  } catch (error) {
    if (error instanceof GitNotInstalledError) return { kind: "git-missing" };
    if (error instanceof GitError && error.message.startsWith("fatal: not a git repository")) {
      return { kind: "not-repo", path };
    }
    throw error;
  }

  let branch: string | null;
  try {
    branch = (await runGit(path, ["symbolic-ref", "--quiet", "--short", "HEAD"])).trim();
  } catch (error) {
    if (!(error instanceof GitError && error.code === 1)) throw error;
    branch = null;
  }
  try {
    const head = (await runGit(path, ["rev-parse", "--verify", "--quiet", "HEAD^{commit}"])).trim();
    return { kind: "ok", path, head, branch };
  } catch (error) {
    if (!(error instanceof GitError && error.code === 1 && branch !== null)) throw error;
    // Only a missing branch ref is unborn. A broken ref/object must stay an error.
    try {
      await runGit(path, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
    } catch (refError) {
      if (refError instanceof GitError && refError.code === 1) return { kind: "empty", path, branch };
      throw refError;
    }
    throw error;
  }
}
