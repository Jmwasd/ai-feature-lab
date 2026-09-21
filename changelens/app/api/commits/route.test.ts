import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GitError, listCommits } from "@/lib/git";
import { createGitFixture, type GitFixture } from "@/tests/helpers/git-fixture";
import { GET } from "./route";

const call = (query = "") => GET(new Request(`http://localhost:3000/api/commits${query}`));
let repo: GitFixture;
const shas: string[] = [];

beforeAll(async () => {
  repo = await createGitFixture();
  vi.stubEnv("CHANGELENS_REPO", repo.path);
  for (let i = 0; i < 51; i++) {
    await repo.write("문서.txt", `내용 ${i}\n`);
    shas.unshift(await repo.commit(`feat: 변경 ${i}`));
  }
}, 30_000);

afterAll(async () => {
  vi.unstubAllEnvs();
  await repo?.cleanup();
});

describe("commits GET route with a real repository", () => {
  it.each(["", "?skip=0"])("returns the first fifty commits for %j", async (query) => {
    const response = await call(query);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.commits).toEqual(await listCommits(repo.path, { skip: 0 }));
    expect(result.commits.map((commit: { sha: string }) => commit.sha)).toEqual(shas.slice(0, 50));
    expect(result.nextSkip).toBe(50);
  });

  it("uses the requested offset and stops after a partial final page", async () => {
    const response = await call("?skip=50");
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.commits).toHaveLength(1);
    expect(result.commits[0]).toMatchObject({ sha: shas[50], files: 1, additions: 1, deletions: 0 });
    expect(result.nextSkip).toBeNull();
  });

  it("returns no continuation after the end of the history", async () => {
    expect(await (await call("?skip=51")).json()).toEqual({ commits: [], nextSkip: null });
  });

  it.each(["", "-1", "1.5", "NaN", "Infinity", "abc", "1e2", "0x10", " 1", "1\n", "9007199254740992"])(
    "rejects an invalid offset %j", async (skip) => {
      const response = await call(`?skip=${encodeURIComponent(skip)}`);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid skip" });
    },
  );

  it("rejects repeated offsets", async () => {
    expect((await call("?skip=0&skip=50")).status).toBe(400);
  });

  it("returns a git failure as JSON with only its first stderr line", async () => {
    vi.stubEnv("CHANGELENS_REPO", repo.root);
    try {
      const failure = await listCommits(repo.root).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(GitError);
      const response = await call();
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: (failure as GitError).stderr.split(/\r?\n/, 1)[0] });
    } finally {
      vi.stubEnv("CHANGELENS_REPO", repo.path);
    }
  });
});
