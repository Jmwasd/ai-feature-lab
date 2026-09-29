import { afterEach, describe, expect, it, vi } from "vitest";
import { MissingEnvError, requireEnv } from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireEnv", () => {
  it("값이 있으면 그대로 돌려준다", () => {
    vi.stubEnv("JUSO_API_KEY", "juso-key-123");
    expect(requireEnv("JUSO_API_KEY")).toBe("juso-key-123");
  });

  it("호출 시점의 값을 읽는다", () => {
    vi.stubEnv("VWORLD_API_KEY", "first");
    expect(requireEnv("VWORLD_API_KEY")).toBe("first");
    vi.stubEnv("VWORLD_API_KEY", "second");
    expect(requireEnv("VWORLD_API_KEY")).toBe("second");
  });

  it("없는 변수면 MissingEnvError를 던진다", () => {
    vi.stubEnv("DATA_GO_KR_SERVICE_KEY", undefined);
    expect(() => requireEnv("DATA_GO_KR_SERVICE_KEY")).toThrow(MissingEnvError);
  });

  it("빈 문자열(.env.example 기본값)도 없는 것으로 본다", () => {
    vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "");
    expect(() => requireEnv("DATA_GO_KR_SERVICE_KEY")).toThrow(MissingEnvError);
  });

  it("오류에는 변수 이름만 담고 값은 담지 않는다", () => {
    vi.stubEnv("JUSO_API_KEY", "");
    vi.stubEnv("VWORLD_API_KEY", "other-secret-value");
    try {
      requireEnv("JUSO_API_KEY");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MissingEnvError);
      const e = error as MissingEnvError;
      expect(e.variable).toBe("JUSO_API_KEY");
      expect(e.message).toContain("JUSO_API_KEY");
      expect(Object.keys(e).sort()).toEqual(["name", "variable"]);
      expect(`${e.message} ${JSON.stringify(e)}`).not.toContain("other-secret-value");
    }
  });
});
