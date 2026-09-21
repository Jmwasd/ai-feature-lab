import { describe, expect, it } from "vitest";
import { sanitizeNext } from "./next";

describe("sanitizeNext", () => {
  it.each(["/", "/repo", "/repo/abc?x=1", "/repo/한글?x=1#diff"])("preserves internal path %s", (path) => {
    expect(sanitizeNext(path)).toBe(path);
  });

  it.each(["//evil.com", "/\\evil.com", "https://x", "http://x", "javascript:alert(1)", "repo", "", null, undefined,
    " /repo", "/\t/evil.com", "/\n/evil.com", "/\r/evil.com"])("rejects non-internal path %s", (path) => {
    expect(sanitizeNext(path)).toBeNull();
  });
});
