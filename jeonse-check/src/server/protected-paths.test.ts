import { describe, expect, it } from "vitest";
import { isProtectedPath, PROTECTED_PREFIXES } from "./protected-paths";

describe("PROTECTED_PREFIXES", () => {
  it("/check와 /saved를 보호한다", () => {
    expect(PROTECTED_PREFIXES).toEqual(["/check", "/saved"]);
  });
});

describe("isProtectedPath", () => {
  it.each([
    "/check",
    "/check/",
    "/check/result",
    "/check/result/123",
    "/saved",
    "/saved/",
    "/saved/abc",
  ])("%s는 보호 경로다", (pathname) => {
    expect(isProtectedPath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "",
    "/checkout",
    "/checks",
    "/saved-items",
    "/savedx/1",
    "/api/auth/signin",
    "/about/check",
    "/Check",
    "check",
  ])("%s는 보호 경로가 아니다", (pathname) => {
    expect(isProtectedPath(pathname)).toBe(false);
  });
});
