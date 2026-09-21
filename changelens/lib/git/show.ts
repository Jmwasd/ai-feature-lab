import type { CommitDetail, FileDiff, FileStat } from "@/types/git";
import { DIFF_ARGS, HISTORY_ARGS, parseHistory } from "./log";
import { GitError, isValidSha, runGit } from "./run";

export class CommitNotFoundError extends Error {
  constructor(public readonly sha: string) {
    super(`Commit not found: ${sha}`);
    this.name = "CommitNotFoundError";
  }
}

async function resolveCommit(repoPath: string, sha: string): Promise<string> {
  if (!isValidSha(sha)) throw new CommitNotFoundError(sha);
  try {
    return (await runGit(repoPath, ["rev-parse", "--verify", "--quiet", `${sha}^{commit}`])).trim();
  } catch (error) {
    if (error instanceof GitError && error.code === 1) throw new CommitNotFoundError(sha);
    throw error;
  }
}

function readPatch(repoPath: string, sha: string): Promise<string> {
  return runGit(repoPath, ["show", ...DIFF_ARGS, "--format=", "--unified=3", sha, "--"]);
}

function parsePatch(patch: string, files: FileStat[]): FileDiff[] {
  const sections = patch.split(/(?=^diff --git )/m).filter(Boolean);
  if (sections.length !== files.length) throw new Error("Git patch and numstat file counts differ");
  return files.map((file, index) => {
    const section = sections[index];
    const bodyStart = section.search(/^@@ /m);
    const body = bodyStart < 0 ? "" : section.slice(bodyStart);
    const diff: FileDiff = {
      path: file.path, ...(file.oldPath === undefined ? {} : { oldPath: file.oldPath }),
      binary: file.additions === null || file.deletions === null,
      omitted: Buffer.byteLength(body, "utf8") > 256 * 1024,
      lineCount: 0, hunks: [],
    };
    // Numstat and patch use identical ordering/options; never split a path on spaces.
    for (const line of body.split("\n")) {
      if (line.startsWith("@@ ")) {
        if (!diff.omitted) diff.hunks.push({ header: line, lines: [] });
        continue;
      }
      const kind = line[0] === "+" ? "add" : line[0] === "-" ? "del" : line[0] === " " ? "ctx" : null;
      if (!kind) continue;
      diff.lineCount++;
      if (!diff.omitted) diff.hunks[diff.hunks.length - 1].lines.push({ kind, text: line });
    }
    return diff;
  });
}

export async function getCommitPatch(repoPath: string, sha: string): Promise<string> {
  return readPatch(repoPath, await resolveCommit(repoPath, sha));
}

export async function getCommitDetail(repoPath: string, sha: string): Promise<CommitDetail> {
  const resolved = await resolveCommit(repoPath, sha);
  const [output, patch] = await Promise.all([
    runGit(repoPath, ["show", ...HISTORY_ARGS, resolved, "--"]),
    readPatch(repoPath, resolved),
  ]);
  const commit = parseHistory(output)[0];
  if (!commit) throw new CommitNotFoundError(sha);
  return { ...commit, diffs: parsePatch(patch, commit.files) };
}
