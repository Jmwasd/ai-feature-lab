import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RESULT_TOKEN_TTL_MS, signResultToken, verifyResultToken } from "./result-token";

const SECRET = "test-result-signing-secret-0123456789abcdef";
const NOW = new Date("2026-09-30T00:00:00Z");
const DATA = { input: { deposit: 150_000_000 }, result: { version: 1, report: { signalCount: 2 } } };

beforeEach(() => {
  vi.stubEnv("RESULT_SIGNING_SECRET", SECRET);
  vi.stubEnv("AUTH_SECRET", "different-auth-secret-0123456789abcdef");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// 토큰의 본문(서명 앞부분)을 바꾼 토큰. 서명은 그대로 둔다.
function withBody(token: string, mutate: (body: Record<string, unknown>) => void): string {
  const [body, signature] = token.split(".");
  const decoded = JSON.parse(Buffer.from(body!, "base64url").toString("utf8")) as Record<string, unknown>;
  mutate(decoded);
  return `${Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url")}.${signature}`;
}

describe("result-token", () => {
  it("서명한 입력·결과를 같은 사용자가 검증하면 그대로 돌려준다", () => {
    const token = signResultToken("u1", DATA, NOW);

    expect(verifyResultToken(token, "u1", NOW)).toEqual(DATA);
  });

  it("다른 사용자가 검증하면 null이다", () => {
    const token = signResultToken("u1", DATA, NOW);

    expect(verifyResultToken(token, "u2", NOW)).toBeNull();
  });

  it("유효 시간이 지나면 null이다", () => {
    const token = signResultToken("u1", DATA, NOW);

    expect(verifyResultToken(token, "u1", new Date(NOW.getTime() + RESULT_TOKEN_TTL_MS - 1))).toEqual(DATA);
    expect(verifyResultToken(token, "u1", new Date(NOW.getTime() + RESULT_TOKEN_TTL_MS))).toBeNull();
  });

  it("본문을 바꾸면(신호 0개로 조작) null이다", () => {
    const token = signResultToken("u1", DATA, NOW);
    const tampered = withBody(token, (body) => {
      (body.result as { report: { signalCount: number } }).report.signalCount = 0;
    });

    expect(verifyResultToken(tampered, "u1", NOW)).toBeNull();
  });

  it("다른 비밀값으로 서명한 토큰은 null이다", () => {
    vi.stubEnv("RESULT_SIGNING_SECRET", "another-result-signing-secret-0123456789");
    const forged = signResultToken("u1", DATA, NOW);
    vi.stubEnv("RESULT_SIGNING_SECRET", SECRET);

    expect(verifyResultToken(forged, "u1", NOW)).toBeNull();
  });

  it.each([
    ["문자열이 아님", { token: "x" }],
    ["빈 문자열", ""],
    ["점이 없음", "abc"],
    ["점이 둘", "a.b.c"],
    ["서명이 짧음", "eyJ9.YQ"],
  ])("형식이 틀린 토큰(%s)은 null이다", (_, token) => {
    expect(verifyResultToken(token, "u1", NOW)).toBeNull();
  });

  it("비밀값이 없거나 짧으면 서명하지 않는다", () => {
    vi.stubEnv("RESULT_SIGNING_SECRET", "");
    expect(() => signResultToken("u1", DATA, NOW)).toThrow(/RESULT_SIGNING_SECRET/);

    vi.stubEnv("RESULT_SIGNING_SECRET", "short");
    expect(() => signResultToken("u1", DATA, NOW)).toThrow(/RESULT_SIGNING_SECRET/);
  });

  it("AUTH_SECRET과 같은 값이면 서명하지 않는다", () => {
    vi.stubEnv("AUTH_SECRET", SECRET);

    expect(() => signResultToken("u1", DATA, NOW)).toThrow(/AUTH_SECRET/);
  });
});
