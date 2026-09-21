export type FileStat = {
  path: string;
  oldPath?: string;
  additions: number | null;
  deletions: number | null;
};

export type CommitSummary = {
  sha: string;
  subject: string;
  authorName: string;
  authorDate: string;
  files: number;
  additions: number;
  deletions: number;
  isMerge: boolean;
};

export type CommitPage = {
  commits: CommitSummary[];
  nextSkip: number | null;
};

export type RepoStatus =
  | { kind: "git-missing" }
  | { kind: "not-repo"; path: string }
  | { kind: "empty"; path: string; branch: string | null }
  | { kind: "ok"; path: string; head: string; branch: string | null };

export type RepoMetrics = {
  head: string;
  branch: string | null;
  totalCommits: number;
  firstDate: string;
  lastDate: string;
  additions: number;
  deletions: number;
  contributors: number;
  topContributor: string;
};

export type DiffLine = { kind: "add" | "del" | "ctx"; text: string };
export type DiffHunk = { header: string; lines: DiffLine[] };
export type FileDiff = {
  path: string;
  oldPath?: string;
  binary: boolean;
  omitted: boolean;
  /** Number of add/del/context lines, excluding headers and no-newline markers. */
  lineCount: number;
  hunks: DiffHunk[];
};

export type CommitDetail = {
  sha: string;
  subject: string;
  body: string;
  authorName: string;
  authorDate: string;
  parents: string[];
  files: FileStat[];
  additions: number;
  deletions: number;
  diffs: FileDiff[];
};
