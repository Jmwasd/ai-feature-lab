import { NextResponse } from "next/server";
import { verifyGoogleIdToken } from "@/lib/auth/google";
import { SESSION_COOKIE, signSession } from "@/lib/auth/session";
import type { Session } from "@/types/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Google client ID is not configured" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid credential" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || !("credential" in body) ||
      typeof body.credential !== "string" || !body.credential.trim()) {
    return NextResponse.json({ error: "invalid credential" }, { status: 400 });
  }

  let session: Session;
  try {
    session = await verifyGoogleIdToken(body.credential, clientId);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const maxAge = session.exp - Math.floor(Date.now() / 1000);
  if (maxAge <= 0) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // register() rejects this configuration at startup; never sign with an empty fallback.
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  const token = await signSession(session, secret);
  const response = NextResponse.json({ email: session.email });
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge });
  return response;
}

export async function DELETE() {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
