import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { SummaryResult } from "@/types/summary";

type CachedSummary = Extract<SummaryResult, { status: "ok" }>;

function cachePath(root: string, repoPath: string, sha: string): string {
  const repoHash = createHash("sha256").update(resolve(repoPath)).digest("hex").slice(0, 16);
  return join(root, repoHash, `${sha}.json`);
}

export async function readCachedSummary(root: string, repoPath: string, sha: string): Promise<CachedSummary | null> {
  try {
    const value: unknown = JSON.parse(await readFile(cachePath(root, repoPath, sha), "utf8"));
    if (typeof value !== "object" || value === null ||
        !("status" in value) || value.status !== "ok" ||
        !("summary" in value) || typeof value.summary !== "string" ||
        !("truncated" in value) || typeof value.truncated !== "boolean" ||
        !("points" in value) || !Array.isArray(value.points) || value.points.length > 3 ||
        !value.points.every((point: unknown) => typeof point === "string")) return null;
    return { status: "ok", summary: value.summary, points: value.points, truncated: value.truncated };
  } catch {
    return null;
  }
}

export async function writeCachedSummary(root: string, repoPath: string, sha: string, result: CachedSummary): Promise<void> {
  const path = cachePath(root, repoPath, sha);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(result), "utf8");
}
