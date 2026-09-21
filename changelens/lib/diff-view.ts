import type { FileDiff } from "@/types/git";

export const COLLAPSE_LINES = 300;

export function startsCollapsed(file: FileDiff): boolean {
  return file.lineCount > COLLAPSE_LINES;
}

export function hunkRange(file: FileDiff): string | null {
  return file.hunks[0]?.header.match(/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/)?.[0] ?? null;
}

export function showCommand(sha: string, path: string): string {
  const quotedPath = /^[\w./-]+$/.test(path) ? path : `'${path.replace(/'/g, "'\\''")}'`;
  return `git show ${sha} -- ${quotedPath}`;
}
