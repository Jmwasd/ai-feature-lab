import type { CommitDetail, CommitSummary, FileStat } from "@/types/git";
import { getRepoStatus } from "./repo";
import { GitError, runGit } from "./run";

// Internal helpers shared by the history/detail readers; the barrel exports only public APIs.
export const DIFF_ARGS = [
  "--no-ext-diff", "--no-textconv", "-M", "--src-prefix=a/", "--dst-prefix=b/",
  "--diff-merges=first-parent", "--no-relative", "--submodule=short",
];
export const HISTORY_ARGS = [
  ...DIFF_ARGS, "--no-decorate", "--encoding=UTF-8", "--numstat", "-z",
  "--pretty=format:%x1e%H%x1f%s%x1f%an%x1f%aI%x1f%P%x1f%b%x00",
];

function parseNumstat(output: string): FileStat[] {
  const tokens = output.replace(/^\n/, "").split("\0");
  const files: FileStat[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!tokens[i] || tokens[i] === "\n") continue;
    const match = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/.exec(tokens[i]);
    if (!match) throw new Error("Invalid git numstat record");
    const file: FileStat = {
      path: match[3], additions: match[1] === "-" ? null : Number(match[1]),
      deletions: match[2] === "-" ? null : Number(match[2]),
    };
    // -z returns old/new paths separately instead of ambiguous a => b or dir/{a => b}/f.
    if (file.path === "") {
      file.oldPath = tokens[++i];
      file.path = tokens[++i];
      if (!file.oldPath || !file.path) throw new Error("Invalid git rename record");
    }
    files.push(file);
  }
  return files;
}

export function parseHistory(output: string): Omit<CommitDetail, "diffs">[] {
  if (!output) return [];
  return output.split(/\x1e(?=[0-9a-f]{40}\x1f)/).slice(1).map((record) => {
    const end = record.indexOf("\0");
    if (end < 0) throw new Error("Invalid git commit record");
    const [sha, subject, authorName, authorDate, parents, ...body] = record.slice(0, end).split("\x1f");
    const files = parseNumstat(record.slice(end + 1));
    return {
      sha, subject, authorName, authorDate, parents: parents ? parents.split(" ") : [],
      body: body.join("\x1f"), files,
      additions: files.reduce((total, file) => total + (file.additions ?? 0), 0),
      deletions: files.reduce((total, file) => total + (file.deletions ?? 0), 0),
    };
  });
}

export async function listCommits(
  repoPath: string,
  opts: { skip?: number; limit?: number } = {},
): Promise<CommitSummary[]> {
  const { skip = 0, limit = 50 } = opts;
  if (![skip, limit].every((value) => Number.isSafeInteger(value) && value >= 0)) {
    throw new RangeError("skip and limit must be non-negative safe integers");
  }
  let output: string;
  try {
    output = await runGit(repoPath, ["log", ...HISTORY_ARGS, `--skip=${skip}`, `--max-count=${limit}`, "HEAD", "--"]);
  } catch (error) {
    if (error instanceof GitError && (await getRepoStatus(repoPath)).kind === "empty") return [];
    throw error;
  }
  return parseHistory(output).map((commit) => ({
    sha: commit.sha, subject: commit.subject, authorName: commit.authorName, authorDate: commit.authorDate,
    files: commit.files.length, additions: commit.additions, deletions: commit.deletions,
    isMerge: commit.parents.length > 1,
  }));
}
