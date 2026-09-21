import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";

export class GitError extends Error {
  constructor(public readonly stderr: string, public readonly code?: number | string) {
    super(stderr.split(/\r?\n/, 1)[0]);
    this.name = "GitError";
  }
}

export class GitNotInstalledError extends Error {
  constructor() {
    super("Git is not installed or is not available on PATH.");
    this.name = "GitNotInstalledError";
  }
}

export function isValidSha(s: string): boolean {
  return /^[0-9a-f]{7,40}$/.exec(s)?.[0] === s;
}

export function resolveRepoPath(): string {
  return resolve(process.env.CHANGELENS_REPO || process.cwd());
}

export async function runGit(repoPath: string, args: string[]): Promise<string> {
  // ENOENT from a nonexistent cwd must not be confused with a missing executable.
  try {
    if (!(await stat(repoPath)).isDirectory()) {
      throw new GitError(`Not a directory: ${repoPath}`, "ENOTDIR");
    }
  } catch (error) {
    if (error instanceof GitError) throw error;
    const failure = error as NodeJS.ErrnoException;
    throw new GitError(failure.message, failure.code);
  }

  // --no-color is a diff/log option, not a git-global option (init/rev-parse reject it).
  // color.ui=false supplies the equivalent for all other subcommands.
  const commandArgs = ["log", "show", "diff"].includes(args[0])
    ? [args[0], "--no-color", ...args.slice(1)]
    : args;
  return new Promise((resolveOutput, reject) => {
    execFile("git", [
      "-c", "core.quotePath=false", "-c", "color.ui=false",
      // Git for Windows also recognizes /dev/null (Node's \\.\nul is not portable to git).
      "-c", "log.showSignature=false", "-c", "diff.orderFile=/dev/null",
      ...commandArgs,
    ], {
      cwd: repoPath,
      maxBuffer: 256 * 1024 * 1024,
      encoding: "utf8",
      windowsHide: true,
      env: { ...process.env, LC_ALL: "C", LANG: "C" },
    }, (error, stdout, stderr) => {
      if (!error) return resolveOutput(stdout);
      if (error.code === "ENOENT") return reject(new GitNotInstalledError());
      reject(new GitError(stderr || error.message, error.code ?? undefined));
    });
  });
}
