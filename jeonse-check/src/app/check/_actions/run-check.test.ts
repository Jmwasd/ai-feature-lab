import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deserializeJudgmentView } from "@/features/judgment/serialize";
import { LookupFailedError } from "@/server/lookup/collect-inputs";
import { PublicDataError } from "@/server/public-data/http";
import { verifyResultToken } from "@/server/saved/result-token";

const { auth, searchAddress, collectPublicInputs } = vi.hoisted(() => ({
  auth: vi.fn(),
  searchAddress: vi.fn(),
  collectPublicInputs: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ auth }));
vi.mock("@/server/public-data/juso", () => ({ searchAddress }));
vi.mock("@/server/lookup/collect-inputs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/lookup/collect-inputs")>()),
  collectPublicInputs,
}));
// 운영 의존성(Prisma)을 불러오지 않는다. collectPublicInputs가 모킹돼 있어 내용은 쓰이지 않는다.
vi.mock("@/server/lookup/default-deps", () => ({ defaultLookupDeps: () => ({}) }));

import { ADDRESS, checkPayload as payload, OTHER_ADDRESS, PUBLIC_INPUTS, SESSION } from "./__fixtures__/run-check";
import { runCheckAction } from "./run-check";

beforeEach(() => {
  auth.mockReset().mockResolvedValue(SESSION);
  searchAddress.mockReset().mockResolvedValue([OTHER_ADDRESS, ADDRESS]);
  collectPublicInputs.mockReset().mockResolvedValue(PUBLIC_INPUTS);
  vi.stubEnv("RESULT_SIGNING_SECRET", "test-result-signing-secret-0123456789abcdef");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runCheckAction", () => {
  it("세션이 없으면 unauthorized이고 외부 조회를 하지 않는다", async () => {
    auth.mockResolvedValue(null);

    expect(await runCheckAction(payload())).toEqual({ ok: false, error: "unauthorized" });
    expect(searchAddress).not.toHaveBeenCalled();
    expect(collectPublicInputs).not.toHaveBeenCalled();
  });

  it.each([
    ["payload가 객체가 아님", "hello"],
    ["보증금이 음수", payload({ lookup: { deposit: -1 } })],
    ["법정동코드 형식 오류", payload({ lookup: { address: { ...payload().lookup.address, admCd: "11" } } })],
    ["권리 입력 누락", { lookup: payload().lookup }],
    ["채권최고액이 문자열", payload({ rights: { maxClaimAmount: "1억" } })],
    ["소유권 이전일이 미래", payload({ rights: { lastOwnershipChangeDate: new Date("2999-01-01T00:00:00Z") } })],
  ])("%s이면 invalid-input이고 외부 조회를 하지 않는다", async (_, input) => {
    expect(await runCheckAction(input)).toEqual({ ok: false, error: "invalid-input" });
    expect(searchAddress).not.toHaveBeenCalled();
    expect(collectPublicInputs).not.toHaveBeenCalled();
  });

  it.each(["officetel", "multi-family"])("MVP 밖 주택 유형(%s)이면 unsupported-house", async (houseType) => {
    expect(await runCheckAction(payload({ lookup: { houseType } }))).toEqual({
      ok: false,
      error: "unsupported-house",
    });
    expect(collectPublicInputs).not.toHaveBeenCalled();
  });

  it("주소를 다시 검색해 같은 건물관리번호가 없으면 address-not-found", async () => {
    searchAddress.mockResolvedValue([OTHER_ADDRESS]);

    expect(await runCheckAction(payload())).toEqual({ ok: false, error: "address-not-found" });
    expect(collectPublicInputs).not.toHaveBeenCalled();
  });

  it("클라이언트가 보낸 법정동코드가 아니라 서버에서 다시 조회한 주소로 수집한다", async () => {
    // 조작된 법정동코드: 형식은 맞지만 실제 건물과 다른 지역
    const tampered = payload({ lookup: { address: { ...payload().lookup.address, admCd: "2611010100" } } });

    const result = await runCheckAction(tampered);

    expect(result.ok).toBe(true);
    expect(searchAddress).toHaveBeenCalledWith(ADDRESS.roadAddress, expect.anything());
    const [target] = collectPublicInputs.mock.calls[0]!;
    expect(target).toEqual({
      address: ADDRESS,
      houseType: "ROW_HOUSE",
      exclusiveArea: 59.8,
      dong: "1동",
      ho: "201호",
    });
  });

  it("성공하면 직렬화한 판정 결과를 돌려준다", async () => {
    const result = await runCheckAction(payload());

    if (!result.ok) throw new Error(`실패: ${result.error}`);
    const { view } = result;
    expect(view.version).toBe(1);
    expect(typeof view.report.dataBaseDate).toBe("string");
    expect(view.report.dataBaseDate).toBe("2026-09-01T00:00:00.000Z");
    expect(view.address).toEqual({ display: ADDRESS.roadAddress, dong: "1동", ho: "201호" });
    expect(view.deposit).toBe(150_000_000);
    expect(view.report.headline).toMatch(/^위험 신호 \d+개$/);
    // 공공데이터 경고가 notes에 들어간다
    expect(view.report.notes.length).toBeGreaterThan(0);
    expect(view).not.toHaveProperty("warnings");

    const restored = deserializeJudgmentView(view);
    expect(restored.report.dataBaseDate).toEqual(PUBLIC_INPUTS.dataBaseDate);
    expect(restored.rights.lastOwnershipChangeDate).toEqual(new Date("2019-03-15T00:00:00Z"));
  });

  it("성공하면 판정 결과와 입력을 묶은 저장 토큰을 함께 돌려준다", async () => {
    const result = await runCheckAction(payload());

    if (!result.ok) throw new Error(`실패: ${result.error}`);
    expect(verifyResultToken(result.saveToken, SESSION.user.id)).toEqual({
      input: {
        address: { display: ADDRESS.roadAddress, dong: "1동", ho: "201호" },
        houseType: "row-house",
        deposit: 150_000_000,
        exclusiveArea: 59.8,
        rights: result.view.rights,
      },
      result: result.view,
    });
    // 다른 사용자는 이 토큰으로 저장할 수 없다
    expect(verifyResultToken(result.saveToken, "someone-else")).toBeNull();
  });

  it("서명 비밀값이 없어도 판정 결과는 돌려주고 저장 토큰만 비운다", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("RESULT_SIGNING_SECRET", "");

    const result = await runCheckAction(payload());

    expect(result).toMatchObject({ ok: true, saveToken: null });
    consoleError.mockRestore();
  });

  it("주소 재조회가 호출 한도에 걸리면 quota", async () => {
    searchAddress.mockRejectedValue(new PublicDataError("quota", "juso", "호출 한도 초과(HTTP 429)"));

    expect(await runCheckAction(payload())).toEqual({ ok: false, error: "quota" });
  });

  it("주소 재조회가 그 밖의 이유로 실패하면 lookup-failed", async () => {
    searchAddress.mockRejectedValue(new PublicDataError("timeout", "juso", "응답 없음"));

    expect(await runCheckAction(payload())).toEqual({ ok: false, error: "lookup-failed" });
  });

  it("공공데이터를 모두 못 가져왔고 실거래 호출 한도 경고가 있으면 quota", async () => {
    collectPublicInputs.mockRejectedValue(
      new LookupFailedError([{ kind: "trades-quota" }, { kind: "building-unavailable" }]),
    );

    expect(await runCheckAction(payload())).toEqual({ ok: false, error: "quota" });
  });

  it("공공데이터를 모두 못 가져왔으면 lookup-failed", async () => {
    collectPublicInputs.mockRejectedValue(new LookupFailedError([{ kind: "building-unavailable" }]));

    expect(await runCheckAction(payload())).toEqual({ ok: false, error: "lookup-failed" });
  });

  it("예상 못 한 예외는 lookup-failed로 바꾸고 메시지를 싣지 않는다", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    collectPublicInputs.mockRejectedValue(new Error("fetch failed https://apis.data.go.kr/?serviceKey=SECRET"));

    const result = await runCheckAction(payload());
    expect(result).toEqual({ ok: false, error: "lookup-failed" });
    expect(JSON.stringify(result)).not.toContain("SECRET");
    consoleError.mockRestore();
  });
});
