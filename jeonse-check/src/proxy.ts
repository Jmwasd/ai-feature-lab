import { NextResponse } from "next/server";

import { auth } from "@/server/auth";
import { isProtectedPath } from "@/server/protected-paths";

// 보호 경로 1차 차단(ADR-002). 보호 페이지와 Server Action은 서버에서 auth()로 다시 확인한다.
// Next 16 proxy는 Node.js 런타임이 기본이라 database 세션을 Prisma로 조회할 수 있다. runtime 설정을 넣지 않는다.
export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  if (request.auth || !isProtectedPath(pathname)) return;

  const redirectUrl = new URL("/", request.nextUrl.origin);
  redirectUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(redirectUrl);
});

// 세션 확인마다 DB를 조회하므로 보호 경로로만 좁힌다(ADR-002).
// 정적 분석 대상이라 상수를 import할 수 없다. src/server/protected-paths.ts의 PROTECTED_PREFIXES와 맞춘다.
export const config = {
  matcher: ["/check/:path*", "/saved/:path*"],
};
