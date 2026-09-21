import type { Session } from "@/types/auth";

export const SESSION_COOKIE = "changelens_session";

const encoder = new TextEncoder();

function encodeBase64url(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64url(value: string) {
  if (!value || /[^A-Za-z0-9_-]/.test(value)) throw new Error("Invalid base64url");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function importKey(secret: string, usage: "sign" | "verify") {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function signSession(session: Session, secret: string): Promise<string> {
  const payload = encodeBase64url(encoder.encode(JSON.stringify(session)));
  const key = await importKey(secret, "sign");
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${encodeBase64url(new Uint8Array(signature))}`;
}

export async function verifySession(
  token: string | undefined, secret: string, nowSec = Math.floor(Date.now() / 1000),
): Promise<Session | null> {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    const bytes = decodeBase64url(payload);
    const key = await importKey(secret, "verify");
    if (!await crypto.subtle.verify("HMAC", key, decodeBase64url(signature), encoder.encode(payload))) return null;

    const session: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (typeof session !== "object" || session === null) return null;
    const value = session as Partial<Session>;
    if (typeof value.sub !== "string" || typeof value.email !== "string" ||
        typeof value.name !== "string" || typeof value.picture !== "string" ||
        typeof value.exp !== "number" || !Number.isFinite(value.exp) || value.exp <= nowSec) return null;
    return { sub: value.sub, email: value.email, name: value.name, picture: value.picture, exp: value.exp };
  } catch {
    return null;
  }
}
