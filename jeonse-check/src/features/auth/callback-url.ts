// 로그인 뒤 돌아갈 기본 경로다.
export const DEFAULT_CALLBACK_URL = "/check";

// 같은 사이트 상대 경로만 허용해 오픈 리다이렉트를 막는다.
// "//evil.com"과 "/\evil.com"은 브라우저가 다른 호스트로 해석하므로 막는다.
export function safeCallbackUrl(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return DEFAULT_CALLBACK_URL;
  if (value[1] === "/" || value[1] === "\\") return DEFAULT_CALLBACK_URL;
  return value;
}
