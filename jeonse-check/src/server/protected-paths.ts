// 로그인이 필요한 경로 접두어. src/proxy.ts의 config.matcher도 같은 목록으로 맞춘다.
// matcher는 빌드 시점에 정적 분석되어야 해서 이 상수를 import할 수 없다(Next proxy 문서).
// 순수 함수라 server-only를 두지 않는다. proxy와 테스트에서 그대로 쓴다.
export const PROTECTED_PREFIXES: readonly string[] = ["/check", "/saved"];

// 접두어와 정확히 같거나 접두어 뒤에 "/"가 이어질 때만 보호한다. "/checkout"은 보호하지 않는다.
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
