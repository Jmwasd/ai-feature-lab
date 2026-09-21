import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyGoogleIdToken } from "./google";

const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class { verifyIdToken = verifyIdToken; },
}));

beforeEach(() => { verifyIdToken.mockReset(); });

describe("Google ID token verification", () => {
  it("passes the audience to Google and selects only Session fields without account restrictions", async () => {
    const session = { sub: "123", email: "dev@any-domain.test", name: "개발자", picture: "https://example.test/p", exp: 2_000_000_000 };
    verifyIdToken.mockResolvedValue({ getPayload: () => ({ ...session, aud: "client-id", iss: "accounts.google.com", hd: "any-domain.test" }) });
    expect(await verifyGoogleIdToken("id-token", "client-id")).toEqual(session);
    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: "id-token", audience: "client-id" });
  });

  it("uses empty strings for optional profile claims", async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: "123", exp: 2_000_000_000 }) });
    expect(await verifyGoogleIdToken("id-token", "client-id")).toEqual({
      sub: "123", exp: 2_000_000_000, email: "", name: "", picture: "",
    });
  });

  it("propagates failed Google verification", async () => {
    verifyIdToken.mockRejectedValue(new Error("invalid ID token"));
    await expect(verifyGoogleIdToken("bad-token", "client-id")).rejects.toThrow("invalid ID token");
  });

  it.each([undefined, {}, { sub: "123" }])("rejects missing required claims: %j", async (payload) => {
    verifyIdToken.mockResolvedValue({ getPayload: () => payload });
    await expect(verifyGoogleIdToken("id-token", "client-id")).rejects.toThrow();
  });
});
