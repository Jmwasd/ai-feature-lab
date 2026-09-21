import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  CommitNotFoundError, GitError, GitNotInstalledError, getCommitDetail,
  getCommitPatch, getRepoMetrics, getRepoStatus, isValidSha, listCommits,
  resolveRepoPath, runGit,
} from "@/lib/git";
import * as runner from "./run";
import { createGitFixture, setGitIdentity, type GitFixture } from "@/tests/helpers/git-fixture";

const fixtures: GitFixture[] = [];
async function fixture() {
  const value = await createGitFixture();
  fixtures.push(value);
  return value;
}

afterAll(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await Promise.all(fixtures.map((value) => value.cleanup()));
});

describe("git layer with real repositories", () => {
  let repo: GitFixture;
  let root: string;
  let edited: string;
  let feature: string;
  let main: string;
  let merge: string;
  const body = "첫 번째 설명\n\t들여쓴 설명\n\n마지막 문단\n";

  beforeAll(async () => {
    repo = await fixture();
    await repo.write("문서 메모.txt", "alpha\nbeta\n");
    await repo.write("before.txt", "rename me\n");
    await repo.write("dir/old/file.txt", "nested rename\n");
    await repo.write("image.bin", new Uint8Array([0, 1, 2, 3]));
    root = await repo.commit("feat: 시작\n\n" + body);
    await repo.git("mv", "before.txt", "after name.txt");
    await repo.git("mv", "dir/old", "dir/new");
    await repo.write("문서 메모.txt", "alpha\nchanged\ngamma\n");
    await repo.write("image.bin", new Uint8Array([0, 4, 5, 6]));
    edited = await repo.commit("refactor: 이름과 내용 변경", "Bob", "2026-01-02T12:00:00+09:00");
    await repo.git("checkout", "-b", "feature");
    await repo.write("feature.txt", "feature\n");
    feature = await repo.commit("feat: branch", "Bob", "2026-01-03T12:00:00+09:00");
    await repo.git("checkout", "main");
    await repo.write("main.txt", "main\n");
    main = await repo.commit("feat: main", "Alice", "2026-01-04T12:00:00+09:00");
    setGitIdentity("Alice", "2026-01-05T12:00:00+09:00");
    await repo.git("merge", "--no-ff", "feature", "-m", "feat: merge");
    merge = (await repo.git("rev-parse", "HEAD")).trim();
  }, 30_000);

  it("preserves the subject, multiline/tabbed body and recorded timezone", async () => {
    const detail = await getCommitDetail(repo.path, root);
    expect(detail).toMatchObject({
      sha: root, subject: "feat: 시작", body, authorName: "Alice",
      authorDate: "2026-01-01T12:00:00+09:00", parents: [], additions: 4, deletions: 0,
    });
    expect(detail.files).toContainEqual({ path: "문서 메모.txt", additions: 2, deletions: 0 });
    expect(detail.files).toContainEqual({ path: "image.bin", additions: null, deletions: null });
    expect(detail.diffs.find((file) => file.path === "image.bin")).toMatchObject({ binary: true, hunks: [], lineCount: 0 });
    expect(detail.diffs.find((file) => file.path === "문서 메모.txt")).toMatchObject({
      binary: false, omitted: false, lineCount: 2,
      hunks: [{ header: "@@ -0,0 +1,2 @@", lines: [{ kind: "add", text: "+alpha" }, { kind: "add", text: "+beta" }] }],
    });
  });

  it("reads both whole-path and directory renames without ambiguous space splitting", async () => {
    const detail = await getCommitDetail(repo.path, edited);
    expect(detail.files).toContainEqual({ path: "after name.txt", oldPath: "before.txt", additions: 0, deletions: 0 });
    expect(detail.files).toContainEqual({ path: "dir/new/file.txt", oldPath: "dir/old/file.txt", additions: 0, deletions: 0 });
    expect(detail.diffs).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "after name.txt", oldPath: "before.txt", hunks: [] }),
      expect.objectContaining({ path: "dir/new/file.txt", oldPath: "dir/old/file.txt", hunks: [] }),
    ]));
    const diff = detail.diffs.find((file) => file.path === "문서 메모.txt")!;
    expect(diff.lineCount).toBe(4);
    expect(diff.hunks[0].lines).toEqual([
      { kind: "ctx", text: " alpha" }, { kind: "del", text: "-beta" },
      { kind: "add", text: "+changed" }, { kind: "add", text: "+gamma" },
    ]);
  });

  it("includes side-branch commits and counts merge changes against the first parent", async () => {
    const commits = await listCommits(repo.path);
    expect(commits.map((commit) => commit.sha)).toEqual([merge, main, feature, edited, root]);
    expect(commits[0]).toMatchObject({ isMerge: true, files: 1, additions: 1, deletions: 0 });
    expect(commits.slice(1).every((commit) => !commit.isMerge)).toBe(true);
    expect(commits.find((commit) => commit.sha === edited)).toMatchObject({ files: 4, additions: 2, deletions: 1 });
    const detail = await getCommitDetail(repo.path, merge);
    expect(detail.parents).toEqual([main, feature]);
    expect(detail.files).toEqual([{ path: "feature.txt", additions: 1, deletions: 0 }]);
    expect(detail.diffs.map((file) => file.path)).toEqual(["feature.txt"]);
  });

  it("honors skip/limit boundaries", async () => {
    expect((await listCommits(repo.path, { skip: 1, limit: 2 })).map((commit) => commit.sha)).toEqual([main, feature]);
    expect((await listCommits(repo.path, { skip: 4, limit: 2 })).map((commit) => commit.sha)).toEqual([root]);
    expect(await listCommits(repo.path, { skip: 5 })).toEqual([]);
    expect(await listCommits(repo.path, { limit: 0 })).toEqual([]);
    await expect(listCommits(repo.path, { skip: -1 })).rejects.toThrow(RangeError);
    await expect(listCommits(repo.path, { limit: 1.5 })).rejects.toThrow(RangeError);
    await expect(listCommits(repo.path, { skip: NaN })).rejects.toThrow(RangeError);
  });

  it("aggregates all history once, excluding merge churn, and shares cached scans", async () => {
    const spy = vi.spyOn(runner, "runGit"); // Observe real calls; do not mock the parser or git.
    try {
      const results = await Promise.all([getRepoMetrics(repo.path), getRepoMetrics(repo.path)]);
      expect(results[0]).toEqual({
        head: merge, branch: "main", totalCommits: 5,
        firstDate: "2026-01-01T12:00:00+09:00", lastDate: "2026-01-05T12:00:00+09:00",
        additions: 8, deletions: 1, contributors: 2, topContributor: "Alice",
      });
      expect(results[1]).toEqual(results[0]);
      expect(await getRepoMetrics(repo.path)).toEqual(results[0]);
      expect(spy.mock.calls.filter(([, args]) => args[0] === "log")).toHaveLength(1);
    } finally { spy.mockRestore(); }
  });

  it("returns an untruncated, deterministic patch for summaries", async () => {
    const patch = await getCommitPatch(repo.path, edited.slice(0, 8));
    expect(patch).toContain("diff --git a/문서 메모.txt b/문서 메모.txt");
    expect(patch).toContain("--- a/문서 메모.txt");
    expect(patch).toContain("+++ b/문서 메모.txt");
    expect(patch).toContain("+changed\n+gamma");
    expect(patch).not.toContain("refactor: 이름과 내용 변경");
  });

  it("rejects invalid, nonexistent and non-commit object IDs", async () => {
    const blob = (await repo.git("rev-parse", `${root}:before.txt`)).trim();
    for (const sha of ["--all", "HEAD", "ABCDEF0", "abcd12", "a".repeat(41), "f".repeat(40), blob]) {
      await expect(getCommitDetail(repo.path, sha)).rejects.toBeInstanceOf(CommitNotFoundError);
      await expect(getCommitPatch(repo.path, sha)).rejects.toBeInstanceOf(CommitNotFoundError);
    }
  });

  it("reports full stderr and its first line without swallowing command failures", async () => {
    const failure = await runGit(repo.path, ["not-a-git-command"]).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(GitError);
    expect((failure as GitError).message).toBe((failure as GitError).stderr.split(/\r?\n/)[0]);
    expect((failure as GitError).message).toContain("not-a-git-command");
    const directory = join(repo.root, "non-repository");
    await mkdir(directory);
    await expect(listCommits(directory)).rejects.toBeInstanceOf(GitError);
    await expect(getCommitDetail(directory, root)).rejects.toBeInstanceOf(GitError);
    await expect(getRepoMetrics(directory)).rejects.toBeInstanceOf(GitError);
  });

  it("classifies missing paths, normal directories, empty repos, branches and detached HEAD", async () => {
    const value = await fixture();
    const missing = join(value.root, "missing");
    expect(await getRepoStatus(missing)).toEqual({ kind: "not-repo", path: missing });
    expect(await getRepoStatus(value.root)).toEqual({ kind: "not-repo", path: value.root });
    expect(await getRepoStatus(value.path)).toEqual({ kind: "empty", path: value.path, branch: "main" });
    expect(await listCommits(value.path)).toEqual([]);
    const head = await value.commit("empty commit");
    expect(await getRepoStatus(value.path)).toEqual({ kind: "ok", path: value.path, head, branch: "main" });
    await value.git("checkout", "--detach", head);
    expect(await getRepoStatus(value.path)).toEqual({ kind: "ok", path: value.path, head, branch: null });
  });

  it("distinguishes missing git from a missing cwd", async () => {
    const originalPath = process.env.PATH;
    vi.stubEnv("PATH", "");
    try {
      expect(await getRepoStatus(repo.path)).toEqual({ kind: "git-missing" });
      expect(await getRepoStatus(join(repo.root, "missing"))).toMatchObject({ kind: "not-repo" });
      await expect(runGit(repo.path, ["status"])).rejects.toBeInstanceOf(GitNotInstalledError);
    } finally { vi.stubEnv("PATH", originalPath); }
  });

  it("refreshes metrics after HEAD changes and branch names even when HEAD does not", async () => {
    const value = await fixture();
    await value.write("a.txt", "one\n");
    await value.commit("one");
    expect((await getRepoMetrics(value.path)).totalCommits).toBe(1);
    await value.write("a.txt", "one\ntwo\n");
    const head = await value.commit("two", "Bob", "2026-01-02T12:00:00+09:00");
    expect(await getRepoMetrics(value.path)).toMatchObject({ head, totalCommits: 2, additions: 2, contributors: 2 });
    await value.git("checkout", "-b", "same-head");
    expect((await getRepoMetrics(value.path)).branch).toBe("same-head");
    await value.git("checkout", "--detach", head);
    expect((await getRepoMetrics(value.path)).branch).toBeNull();
  });

  it("uses chronological date extrema even with out-of-order author dates", async () => {
    const value = await fixture();
    await value.commit("later root", "Alice", "2026-02-01T12:00:00+09:00");
    await value.commit("earlier child", "Alice", "2026-01-01T12:00:00-05:00");
    expect(await getRepoMetrics(value.path)).toMatchObject({
      firstDate: "2026-01-01T12:00:00-05:00", lastDate: "2026-02-01T12:00:00+09:00",
    });
  });

  it("omits a file over 256KB in UTF-8 bytes while retaining line counts and raw patches", async () => {
    const value = await fixture();
    const text = "가".repeat(90) + "\n";
    await value.write("huge.txt", text.repeat(1000));
    await value.write("small.txt", "small\n");
    const sha = await value.commit("large diff");
    const detail = await getCommitDetail(value.path, sha);
    expect(detail.diffs.find((file) => file.path === "huge.txt")).toMatchObject({ omitted: true, binary: false, hunks: [], lineCount: 1000 });
    expect(detail.diffs.find((file) => file.path === "small.txt")).toMatchObject({ omitted: false, lineCount: 1 });
    expect(Buffer.byteLength(await getCommitPatch(value.path, sha))).toBeGreaterThan(256 * 1024);
  });

  it("handles multiple hunks, deletion and missing final newline", async () => {
    const value = await fixture();
    await value.write("spaced b/문서 메모.txt", Array.from({ length: 30 }, (_, i) => `line ${i}\n`).join(""));
    await value.write("delete me.txt", "goodbye");
    await value.commit("initial");
    await value.write("spaced b/문서 메모.txt", Array.from({ length: 30 }, (_, i) => `${i === 1 || i === 28 ? "edited" : "line"} ${i}\n`).join(""));
    await value.git("rm", "delete me.txt");
    const sha = await value.commit("edit and delete");
    const detail = await getCommitDetail(value.path, sha);
    expect(detail.diffs.find((file) => file.path === "spaced b/문서 메모.txt")?.hunks).toHaveLength(2);
    expect(detail.diffs.find((file) => file.path === "delete me.txt")).toMatchObject({
      lineCount: 1, hunks: [{ header: "@@ -1 +0,0 @@", lines: [{ kind: "del", text: "-goodbye" }] }],
    });
  });

  it("ignores user formatting, rename, textconv and external-diff settings", async () => {
    const value = await fixture();
    await value.write("old name.txt", "old\n");
    await value.write(".gitattributes", "*.txt diff=custom\n");
    await value.commit("root");
    await value.git("mv", "old name.txt", "new name.txt");
    const sha = await value.commit("rename");
    for (const [key, setting] of Object.entries({
      "color.ui": "always", "core.quotePath": "true", "diff.renames": "false",
      "diff.noprefix": "true", "diff.mnemonicPrefix": "true", "diff.orderFile": "missing-order-file",
      "diff.external": "nonexistent-diff-command", "diff.custom.textconv": "nonexistent-textconv-command",
      "log.showSignature": "true", "log.decorate": "full",
    })) { await value.git("config", key, setting); }
    const detail = await getCommitDetail(value.path, sha);
    expect(detail.files).toEqual([{ path: "new name.txt", oldPath: "old name.txt", additions: 0, deletions: 0 }]);
    expect(detail.diffs).toHaveLength(1);
    expect(await getCommitPatch(value.path, sha)).toContain("diff --git a/old name.txt b/new name.txt");
    expect((await listCommits(value.path))[0].sha).toBe(sha);
  });

  it("does not classify a corrupt repository as empty", async () => {
    const value = await fixture();
    await value.commit("root");
    await writeFile(join(value.path, ".git", "refs", "heads", "main"), "f".repeat(40) + "\n");
    await expect(getRepoStatus(value.path)).rejects.toBeInstanceOf(GitError);
  });

  it("defaults to 50 commits per page", async () => {
    const value = await fixture();
    for (let i = 0; i < 51; i++) { await value.commit(`commit ${i}`); }
    expect(await listCommits(value.path)).toHaveLength(50);
    expect(await listCommits(value.path, { skip: 50 })).toHaveLength(1);
  }, 60_000);

  it("validates SHA syntax and resolves only the server environment path", () => {
    expect(isValidSha("abcdef0")).toBe(true);
    expect(isValidSha("0123456789abcdef".repeat(2))).toBe(true);
    for (const sha of ["HEAD", "ABCDEF0", "abc123", "a".repeat(41), "abcdef0\n", "abcdef0\r", "abcdef0\r\n", "abcdef0;echo hi"]) {
      expect(isValidSha(sha)).toBe(false);
    }
    const original = process.env.CHANGELENS_REPO;
    try {
      vi.stubEnv("CHANGELENS_REPO", undefined);
      expect(resolveRepoPath()).toBe(process.cwd());
      vi.stubEnv("CHANGELENS_REPO", "relative-repo");
      expect(resolveRepoPath()).toBe(resolve("relative-repo"));
    } finally { vi.stubEnv("CHANGELENS_REPO", original); }
  });
});
