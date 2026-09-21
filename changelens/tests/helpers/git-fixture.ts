import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { vi } from "vitest";
import { runGit } from "@/lib/git";

export function setGitIdentity(name = "Alice", date = "2026-01-01T12:00:00+09:00") {
  for (const role of ["AUTHOR", "COMMITTER"]) {
    vi.stubEnv(`GIT_${role}_NAME`, name);
    vi.stubEnv(`GIT_${role}_EMAIL`, `${name.toLowerCase()}@example.test`);
    vi.stubEnv(`GIT_${role}_DATE`, date);
  }
}

export async function createGitFixture() {
  const root = await mkdtemp(join(tmpdir(), "changelens-test-"));
  const path = join(root, "repo");
  await mkdir(path);
  const config = join(root, "empty.gitconfig");
  await writeFile(config, "");
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_CONFIG", "GIT_CONFIG_PARAMETERS"]) {
    vi.stubEnv(key, undefined);
  }
  vi.stubEnv("GIT_CONFIG_COUNT", "0");
  vi.stubEnv("GIT_CONFIG_GLOBAL", config);
  vi.stubEnv("GIT_CONFIG_NOSYSTEM", "1");
  setGitIdentity();
  const git = (...args: string[]) => runGit(path, args);
  await git("init", "-b", "main");
  await git("config", "core.autocrlf", "false");
  return {
    root,
    path,
    git,
    async write(file: string, content: string | Uint8Array) {
      const target = join(path, file);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    },
    async commit(message: string, name = "Alice", date = "2026-01-01T12:00:00+09:00") {
      setGitIdentity(name, date);
      await git("add", "--all");
      await git("commit", "--allow-empty", "--cleanup=verbatim", "-m", message);
      return (await git("rev-parse", "HEAD")).trim();
    },
    async cleanup() {
      if (!resolve(root).startsWith(resolve(tmpdir()) + sep) || !root.includes("changelens-test-")) {
        throw new Error("Refusing to remove a path outside the fixture directory");
      }
      await rm(root, { recursive: true, force: true });
    },
  };
}

export type GitFixture = Awaited<ReturnType<typeof createGitFixture>>;
