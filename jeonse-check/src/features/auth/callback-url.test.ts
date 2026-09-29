import { describe, expect, it } from "vitest";
import { DEFAULT_CALLBACK_URL, safeCallbackUrl } from "./callback-url";

describe("safeCallbackUrl", () => {
  it("기본값은 /check다", () => {
    expect(DEFAULT_CALLBACK_URL).toBe("/check");
  });

  it.each(["/", "/check", "/check?deposit=2억", "/saved/abc#top"])("같은 사이트 상대 경로 %s는 그대로 둔다", (value) => {
    expect(safeCallbackUrl(value)).toBe(value);
  });

  it.each([
    "https://evil.com",
    "http://localhost:3000/check",
    "javascript:alert(1)",
    "//evil.com",
    "/\\evil.com",
    "check",
    "",
    null,
    undefined,
    ["/check"],
  ])("%s는 /check로 바꾼다", (value) => {
    expect(safeCallbackUrl(value)).toBe("/check");
  });
});
