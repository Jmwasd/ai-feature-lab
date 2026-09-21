import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/api/session" && request.method !== "DELETE") return NextResponse.next();

  const secret = process.env.AUTH_SECRET;
  const session = secret ? await verifySession(request.cookies.get(SESSION_COOKIE)?.value, secret) : null;
  if (session) return NextResponse.next();

  if (pathname === "/repo" || pathname.startsWith("/repo/")) {
    const url = new URL("/", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url, 303);
  }
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export const config = {
  matcher: ["/repo/:path*", "/repo", "/api/commits", "/api/summary/:path*", "/api/session"],
};
