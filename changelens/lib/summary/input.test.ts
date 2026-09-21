import { describe, expect, it } from "vitest";
import type { CommitDetail } from "@/types/git";
import { buildSummaryInput } from "./input";

const detail: CommitDetail = {
  sha: "a".repeat(40), subject: "feat: 한글 제목", body: "설명 첫 줄\n\t둘째 줄\n\n끝\n",
  authorName: "Alice", authorDate: "2026-01-01T12:00:00+09:00", parents: [],
  files: [
    { path: "새 이름.txt", oldPath: "옛 이름.txt", additions: 12, deletions: 3 },
    { path: "image.bin", additions: null, deletions: null },
  ], additions: 12, deletions: 3, diffs: [],
};
const limit = 204_800;

describe("buildSummaryInput", () => {
  it("preserves the full message, rename, binary numstat and patch", () => {
    const patch = "diff --git a/한글.txt b/한글.txt\n+내용\n";
    const result = buildSummaryInput(detail, patch);
    expect(result.truncated).toBe(false);
    expect(result.text).toContain(detail.subject + "\n\n" + detail.body);
    expect(result.text).toContain("12\t3\t옛 이름.txt => 새 이름.txt");
    expect(result.text).toContain("-\t-\timage.bin");
    expect(result.text.endsWith(patch)).toBe(true);
  });

  it("does not truncate a patch of exactly 200KB", () => {
    const patch = "a".repeat(limit);
    expect(buildSummaryInput(detail, patch)).toMatchObject({ truncated: false });
    expect(buildSummaryInput(detail, patch).text.endsWith(patch)).toBe(true);
  });

  it.each(["가", "😀"])("cuts on a valid UTF-8 boundary for %s and reports truncation", (character) => {
    const patch = "a" + character.repeat(limit);
    const result = buildSummaryInput(detail, patch);
    const body = result.text.split("\n\nDiff:\n")[1];
    expect(result.truncated).toBe(true);
    expect(result.text).toContain("diff가 잘렸다");
    expect(Buffer.byteLength(body, "utf8")).toBeLessThanOrEqual(limit);
    expect(Buffer.byteLength(body, "utf8")).toBeGreaterThan(limit - 4);
    expect(patch.startsWith(body)).toBe(true);
    expect(body).not.toContain("\uFFFD");
  });

  it("never limits the message or numstat, even when those alone exceed 200KB", () => {
    const files = Array.from({ length: 10_000 }, (_, i) => ({
      path: `폴더/전체파일-${i}.txt`, additions: i, deletions: i + 1,
    }));
    const full = { ...detail, body: "설명".repeat(limit), files };
    const result = buildSummaryInput(full, "x".repeat(limit + 1));
    expect(result.text).toContain(full.body);
    for (const file of files) {
      expect(result.text).toContain(`${file.additions}\t${file.deletions}\t${file.path}`);
    }
    expect(result.truncated).toBe(true);
  });
});
