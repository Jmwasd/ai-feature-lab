import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// 판정 결과 저장 토큰. runCheckAction이 서버에서 만든 판정 결과·입력을 사용자에게 묶어 서명하고,
// 저장 액션은 이 서명을 확인한 값만 저장한다. 클라이언트가 결과를 바꾸면 서명이 맞지 않는다.
// 비밀값은 RESULT_SIGNING_SECRET 하나만 쓴다. AUTH_SECRET을 재사용하거나 파생하지 않는다.
// 한 비밀값이 새면 세션과 결과 서명이 함께 뚫리기 때문이다.
// 토큰 본문은 서명만 하고 암호화하지 않는다. 담긴 값은 사용자가 입력했거나 이미 화면에서 본 결과다.

/** 결과를 보고 저장을 누르기까지 기다리는 시간. 지나면 다시 조회해야 저장할 수 있다. */
export const RESULT_TOKEN_TTL_MS = 60 * 60 * 1000;

const MIN_SECRET_LENGTH = 32;
// 다른 용도의 HMAC과 섞이지 않도록 서명 대상 앞에 붙인다.
const SIGNING_CONTEXT = "jeonse-check.saved-result.v1";
const SIGNATURE_BYTES = 32; // SHA-256

export interface ResultTokenData {
  input: unknown;
  result: unknown;
}

interface TokenBody extends ResultTokenData {
  sub: string; // userId
  exp: number; // epoch ms
}

/** 비밀값이 없거나 짧거나 AUTH_SECRET과 같으면 예외를 던진다. */
export function signResultToken(userId: string, data: ResultTokenData, now: Date = new Date()): string {
  const secret = readSecret();
  const body: TokenBody = { sub: userId, exp: now.getTime() + RESULT_TOKEN_TTL_MS, input: data.input, result: data.result };
  const encoded = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  return `${encoded}.${sign(secret, encoded).toString("base64url")}`;
}

/**
 * 서명·사용자·유효 시간이 모두 맞으면 서명한 입력·결과를, 아니면 null을 돌려준다.
 * 비밀값 설정 오류는 null이 아니라 예외로 알린다(토큰 문제와 서버 설정 문제를 구분한다).
 */
export function verifyResultToken(token: unknown, userId: string, now: Date = new Date()): ResultTokenData | null {
  const secret = readSecret();
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts as [string, string];

  const actual = Buffer.from(signature, "base64url");
  const expected = sign(secret, encoded);
  if (actual.length !== SIGNATURE_BYTES || !timingSafeEqual(actual, expected)) return null;

  let body: unknown;
  try {
    body = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isTokenBody(body) || body.sub !== userId || now.getTime() >= body.exp) return null;
  return { input: body.input, result: body.result };
}

function sign(secret: string, encoded: string): Buffer {
  return createHmac("sha256", secret).update(`${SIGNING_CONTEXT}.${encoded}`).digest();
}

function readSecret(): string {
  const secret = process.env.RESULT_SIGNING_SECRET ?? "";
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`RESULT_SIGNING_SECRET이 없거나 ${MIN_SECRET_LENGTH}자보다 짧습니다.`);
  }
  if (secret === process.env.AUTH_SECRET) {
    throw new Error("RESULT_SIGNING_SECRET은 AUTH_SECRET과 다른 값이어야 합니다.");
  }
  return secret;
}

function isTokenBody(value: unknown): value is TokenBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return typeof body.sub === "string" && typeof body.exp === "number" && "input" in body && "result" in body;
}
