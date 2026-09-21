// Node-only: imported by the session route, never by middleware or client components.
import { OAuth2Client } from "google-auth-library";
import type { Session } from "@/types/auth";

const client = new OAuth2Client();

export async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<Session> {
  const ticket = await client.verifyIdToken({ idToken, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload || typeof payload.sub !== "string" ||
      typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    throw new Error("Google ID token is missing required session claims");
  }
  return {
    sub: payload.sub, email: payload.email ?? "", name: payload.name ?? "",
    picture: payload.picture ?? "", exp: payload.exp,
  };
}
