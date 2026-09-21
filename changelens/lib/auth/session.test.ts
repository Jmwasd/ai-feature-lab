import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/types/auth";
import { SESSION_COOKIE, signSession, verifySession } from "./session";

const session: Session = {
  sub: "google-user", email: "dev@example.test", name: "개발자 👩‍💻",
  picture: "https://example.test/photo", exp: 2_000_000_000,
};
const secret = "test-session-secret";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("signed sessions", () => {
  it("round trips Unicode through two unpadded base64url segments using Web Crypto verification", async () => {
    const verify = vi.spyOn(crypto.subtle, "verify");
    const token = await signSession(session, secret);
    expect(SESSION_COOKIE).toBe("changelens_session");
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(await verifySession(token, secret, session.exp - 1)).toEqual(session);
    expect(verify).toHaveBeenCalled();
  });

  it("rejects changed payloads, signatures and a different secret", async () => {
    const token = await signSession(session, secret);
    const [payload, signature] = token.split(".");
    const [changedPayload] = (await signSession({ ...session, email: "other@example.test" }, secret)).split(".");
    const changedSignature = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
    for (const changed of [`${changedPayload}.${signature}`, `${payload}.${changedSignature}`]) {
      expect(await verifySession(changed, secret, session.exp - 1)).toBeNull();
    }
    expect(await verifySession(token, "other-secret", session.exp - 1)).toBeNull();
  });

  it("expires at exp, using the current epoch seconds by default", async () => {
    const token = await signSession(session, secret);
    expect(await verifySession(token, secret, session.exp)).toBeNull();
    expect(await verifySession(token, secret, session.exp + 1)).toBeNull();
    vi.useFakeTimers();
    vi.setSystemTime((session.exp - 1) * 1000);
    expect(await verifySession(token, secret)).toEqual(session);
    vi.setSystemTime(session.exp * 1000);
    expect(await verifySession(token, secret)).toBeNull();
  });

  it.each([undefined, "", "abc", ".", "a.b.c", "a.b", "@@.AA", "e30=.AA", "e30.AA\n"])(
    "returns null for malformed token %s", async (token) => {
      await expect(verifySession(token, secret)).resolves.toBeNull();
    },
  );

  it.each([null, {}, { ...session, exp: "2000000000" }, { ...session, exp: Infinity }, { ...session, name: 123 }])(
    "rejects signed JSON that is not a Session: %j", async (payload) => {
      const token = await signSession(payload as Session, secret);
      expect(await verifySession(token, secret, session.exp - 1)).toBeNull();
    },
  );

  it("returns null instead of throwing when Web Crypto fails", async () => {
    const token = await signSession(session, secret);
    vi.spyOn(crypto.subtle, "verify").mockRejectedValue(new Error("crypto failure"));
    await expect(verifySession(token, secret, session.exp - 1)).resolves.toBeNull();
  });
});
