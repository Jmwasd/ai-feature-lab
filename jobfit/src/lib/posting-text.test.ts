import { describe, expect, it } from "vitest";

import {
  MAX_POSTING_CHARS,
  MIN_POSTING_LENGTH,
  isExtractionSufficient,
  normalizePostingText,
  truncatePostingText,
} from "./posting-text";

describe("normalizePostingText", () => {
  it("collapses four consecutive line breaks to two", () => {
    expect(normalizePostingText("지원 자격\n\n\n\nReact 경험")).toBe(
      "지원 자격\n\nReact 경험",
    );
  });

  it("collapses consecutive whitespace within a line", () => {
    expect(normalizePostingText("TypeScript    strict\tmode")).toBe(
      "TypeScript strict mode",
    );
  });

  it("preserves line breaks between posting items", () => {
    const normalized = normalizePostingText("지원 자격\nReact 경험\nTypeScript 경험");

    expect(normalized).toContain("지원 자격\nReact 경험");
    expect(normalized.split("\n")).toHaveLength(3);
  });
});

describe("isExtractionSufficient", () => {
  it("rejects 399 normalized characters and accepts 400", () => {
    expect(isExtractionSufficient("가".repeat(MIN_POSTING_LENGTH - 1))).toBe(false);
    expect(isExtractionSufficient("가".repeat(MIN_POSTING_LENGTH))).toBe(true);
  });

  it("rejects 400 whitespace characters after normalization", () => {
    expect(isExtractionSufficient(" ".repeat(MIN_POSTING_LENGTH))).toBe(false);
  });
});

describe("truncatePostingText", () => {
  it("returns text at or below the maximum unchanged", () => {
    const text = "가".repeat(MAX_POSTING_CHARS);

    expect(truncatePostingText(text)).toBe(text);
  });

  it("truncates overlong text, stays within the limit, and appends a notice", () => {
    const truncated = truncatePostingText("가".repeat(MAX_POSTING_CHARS + 1));

    expect(truncated.length).toBeLessThanOrEqual(MAX_POSTING_CHARS);
    expect(truncated).toMatch(/\[본문이 길어 일부가 잘렸습니다\.\]$/);
  });
});
