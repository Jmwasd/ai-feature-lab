import { resolve } from "node:path";
import type { RepoMetrics } from "@/types/git";
import { HISTORY_ARGS, parseHistory } from "./log";
import { getRepoStatus } from "./repo";
import { GitError, GitNotInstalledError, runGit } from "./run";

type CachedMetrics = Omit<RepoMetrics, "branch">;
// One entry per path, replaced on HEAD change, also deduplicates simultaneous scans.
const cache = new Map<string, { head: string; result: Promise<CachedMetrics> }>();

async function scan(repoPath: string, head: string): Promise<CachedMetrics> {
  const commits = parseHistory(await runGit(repoPath, ["log", ...HISTORY_ARGS, head, "--"]));
  const authors = new Map<string, number>();
  let firstDate = commits[0].authorDate;
  let lastDate = firstDate;
  let additions = 0;
  let deletions = 0;
  let topContributor = "";
  let topCount = 0;
  for (const commit of commits) {
    if (Date.parse(commit.authorDate) < Date.parse(firstDate)) firstDate = commit.authorDate;
    if (Date.parse(commit.authorDate) > Date.parse(lastDate)) lastDate = commit.authorDate;
    const count = (authors.get(commit.authorName) ?? 0) + 1;
    authors.set(commit.authorName, count);
    if (count > topCount) { topCount = count; topContributor = commit.authorName; }
    if (commit.parents.length < 2) { additions += commit.additions; deletions += commit.deletions; }
  }
  return { head, totalCommits: commits.length, firstDate, lastDate, additions, deletions, contributors: authors.size, topContributor };
}

export async function getRepoMetrics(repoPath: string): Promise<RepoMetrics> {
  const path = resolve(repoPath);
  const status = await getRepoStatus(path);
  if (status.kind === "git-missing") throw new GitNotInstalledError();
  if (status.kind !== "ok") {
    // Preserve git's own error for empty/non-repository paths, rather than inventing metrics.
    await runGit(path, ["rev-parse", "--verify", "HEAD^{commit}"]);
    throw new GitError("Repository HEAD changed while reading metrics; retry the request.");
  }
  let entry = cache.get(path);
  if (!entry || entry.head !== status.head) {
    const result = scan(path, status.head);
    entry = { head: status.head, result };
    cache.set(path, entry);
    result.catch(() => { if (cache.get(path)?.result === result) cache.delete(path); });
  }
  return { ...await entry.result, branch: status.branch };
}
