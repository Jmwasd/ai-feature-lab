import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { register } from "./instrumentation";

beforeEach(() => {
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("NEXT_PHASE", undefined);
  vi.stubEnv("AUTH_SECRET", undefined);
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("server startup configuration", () => {
  it.each([undefined, ""])("stops Node startup without AUTH_SECRET (%s) and explains generation", (secret) => {
    vi.stubEnv("AUTH_SECRET", secret);
    expect(() => register()).toThrow("AUTH_SECRET");
    expect(() => register()).toThrow(".env.local");
    expect(() => register()).toThrow(`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`);
  });

  it("allows production builds without AUTH_SECRET", () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    expect(() => register()).not.toThrow();
  });

  it("allows Node startup with AUTH_SECRET", () => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
    expect(() => register()).not.toThrow();
  });

  it("does not check startup configuration in Edge", () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    expect(() => register()).not.toThrow();
  });
});
