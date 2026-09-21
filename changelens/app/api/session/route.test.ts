import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyGoogleIdToken } from "@/lib/auth/google";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { DELETE, POST } from "./route";

vi.mock("@/lib/auth/google", () => ({ verifyGoogleIdToken: vi.fn() }));
const session = { sub: "123", email: "dev@example.test", name: "개발자", picture: "", exp: 2_000_003_600 };
const secret = "route-test-secret";
const request = (body: unknown) => new Request("http://localhost:3000/api/session", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(2_000_000_000_000);
  vi.stubEnv("AUTH_SECRET", secret);
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "client-id");
  vi.mocked(verifyGoogleIdToken).mockReset().mockResolvedValue(session);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("session route", () => {
  it("sets a signed localhost cookie expiring with the Google token and returns only email", async () => {
    const response = await POST(request({ credential: "google-token" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: session.email });
    expect(verifyGoogleIdToken).toHaveBeenCalledWith("google-token", "client-id");
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=3600");
    expect(cookie).not.toMatch(/;\s*Secure/i);
    expect(await verifySession(response.cookies.get(SESSION_COOKIE)?.value, secret)).toEqual(session);
  });

  it("returns 401 without a cookie on failed verification", async () => {
    vi.mocked(verifyGoogleIdToken).mockRejectedValue(new Error("bad token"));
    const response = await POST(request({ credential: "bad-token" }));
    expect(response.status).toBe(401);
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it.each([undefined, ""])("returns 503 when the Google client ID is absent (%s)", async (clientId) => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", clientId);
    expect((await POST(request({ credential: "google-token" }))).status).toBe(503);
    expect(verifyGoogleIdToken).not.toHaveBeenCalled();
  });

  it.each([null, [], {}, { credential: 123 }, { credential: "" }, { credential: "  " }])("rejects malformed body %j with 400", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(verifyGoogleIdToken).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await POST(new Request("http://localhost:3000/api/session", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
    expect(verifyGoogleIdToken).not.toHaveBeenCalled();
  });

  it("does not issue an already expired cookie", async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({ ...session, exp: 2_000_000_000 });
    const response = await POST(request({ credential: "expired-token" }));
    expect(response.status).toBe(401);
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("deletes the root cookie with an empty 204 response", async () => {
    const response = await DELETE();
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.cookies.get(SESSION_COOKIE)?.value).toBe("");
    expect(response.headers.get("set-cookie")).toContain("Path=/");
    expect(response.cookies.get(SESSION_COOKIE)?.expires?.getTime()).toBe(0);
  });
});
