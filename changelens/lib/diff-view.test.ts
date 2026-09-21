import { describe, expect, it } from "vitest";
import type { FileDiff } from "@/types/git";
import { COLLAPSE_LINES, hunkRange, showCommand, startsCollapsed } from "./diff-view";

function file(overrides: Partial<FileDiff> = {}): FileDiff {
  return { path: "src/index.ts", binary: false, omitted: false, lineCount: 0, hunks: [], ...overrides };
}

describe("initial diff visibility", () => {
  it("uses the required boundary", () => {
    expect(COLLAPSE_LINES).toBe(300);
  });

  it.each([[0, false], [299, false], [300, false], [301, true], [10000, true]])(
    "starts collapsed for %i lines: %s", (lineCount, expected) => {
      expect(startsCollapsed(file({ lineCount }))).toBe(expected);
    },
  );

  it("uses the recorded count even when an oversized diff has no hunks", () => {
    expect(startsCollapsed(file({ omitted: true, lineCount: 500 }))).toBe(true);
  });
});

describe("first hunk range", () => {
  it.each([
    ["@@ -1,8 +1,34 @@ function render()", "@@ -1,8 +1,34 @@"],
    ["@@ -1 +2 @@", "@@ -1 +2 @@"],
    ["@@ -0,0 +1,3 @@", "@@ -0,0 +1,3 @@"],
    ["@@ -9,2 +9 @@ trailing @@ text", "@@ -9,2 +9 @@"],
  ])("extracts the range from %s", (header, expected) => {
    expect(hunkRange(file({ hunks: [
      { header, lines: [] },
      { header: "@@ -100,2 +101,3 @@", lines: [] },
    ] }))).toBe(expected);
  });

  it.each([{ binary: true }, { omitted: true }, {}])("handles a diff with no hunks: %j", (flags) => {
    expect(hunkRange(file(flags))).toBeNull();
  });

  it("does not present a malformed header as a range", () => {
    expect(hunkRange(file({ hunks: [{ header: "not a hunk", lines: [] }] }))).toBeNull();
  });
});

describe("git show command for omitted files", () => {
  it.each([
    ["src/index.ts", "src/index.ts"],
    ["-file.txt", "-file.txt"],
    ["docs/change log.md", "'docs/change log.md'"],
    ["문서/변경 내용.md", "'문서/변경 내용.md'"],
    ["it's a file.txt", "'it'\\''s a file.txt'"],
    ['say "hello".txt', '\'say "hello".txt\''],
    ["$(touch marker);`pwd`$HOME.txt", "'$(touch marker);`pwd`$HOME.txt'"],
    ["*.txt", "'*.txt'"],
    ["line\nbreak\tfile.txt", "'line\nbreak\tfile.txt'"],
  ])("quotes the literal path %s", (path, quoted) => {
    expect(showCommand("abc1234", path)).toBe(`git show abc1234 -- ${quoted}`);
  });
});
