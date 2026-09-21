import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, signSession } from "@/lib/auth/session";
import { middleware } from "./middleware";

const secret = "middleware-test-secret";
const request = (path: string, method = "GET", token?: string) => new NextRequest(`http://localhost:3000${path}`, {
  method, headers: token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {},
});
beforeEach(() => { vi.stubEnv("AUTH_SECRET", secret); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("session middleware", () => {
  it.each(["/repo", "/repo/x?x=1&file=%ED%95%9C%EA%B8%80"])("redirects %s with 303 and preserves path and query", async (path) => {
    const response = await middleware(request(path));
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe("http://localhost:3000");
    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("next")).toBe(path);
  });

  it.each([["/api/commits?skip=50", "GET"], ["/api/summary/abcdef0", "GET"], ["/api/session", "DELETE"]])(
    "returns 401 JSON for %s %s instead of redirecting", async (path, method) => {
      const response = await middleware(request(path, method));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "unauthorized" });
      expect(response.headers.has("location")).toBe(false);
    },
  );

  it("allows the public POST /api/session without a cookie", async () => {
    const response = await middleware(request("/api/session", "POST"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each([["/repo/x", "GET"], ["/api/commits", "GET"], ["/api/summary/abcdef0", "GET"], ["/api/session", "DELETE"]])(
    "allows a valid cookie on %s %s", async (path, method) => {
      const token = await signSession({ sub: "123", email: "dev@example.test", name: "Dev", picture: "", exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
      const response = await middleware(request(path, method, token));
      expect(response.headers.get("x-middleware-next")).toBe("1");
    },
  );

  it("rejects malformed and expired cookies", async () => {
    const token = await signSession({ sub: "123", email: "", name: "", picture: "", exp: 1 }, secret);
    for (const value of [token, "broken.token"]) {
      expect((await middleware(request("/api/commits", "GET", value))).status).toBe(401);
    }
  });
});
