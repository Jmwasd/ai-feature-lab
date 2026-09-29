import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemorySavedResultRepository } from "@/server/saved/memory-repository";
import { MAX_SAVED_PER_USER, type SavedResultRepository } from "@/server/saved/repository";

const { auth, searchAddress, collectPublicInputs, repoRef } = vi.hoisted(() => ({
  auth: vi.fn(),
  searchAddress: vi.fn(),
  collectPublicInputs: vi.fn(),
  repoRef: { current: null as SavedResultRepository | null },
}));
vi.mock("@/server/auth", () => ({ auth }));
vi.mock("@/server/public-data/juso", () => ({ searchAddress }));
vi.mock("@/server/lookup/collect-inputs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/lookup/collect-inputs")>()),
  collectPublicInputs,
}));
vi.mock("@/server/lookup/default-deps", () => ({ defaultLookupDeps: () => ({}) }));
// Prisma 대신 같은 계약을 지키는 in-memory 저장소를 쓴다.
vi.mock("@/server/saved/prisma-repository", () => ({ createPrismaSavedResultRepository: () => repoRef.current }));

import { ADDRESS, checkPayload, OTHER_ADDRESS, PUBLIC_INPUTS, SESSION } from "./__fixtures__/run-check";
import { runCheckAction } from "./run-check";
import { saveResultAction } from "./save-result";

const USER_ID = SESSION.user.id;
const OTHER_SESSION = { ...SESSION, user: { id: "u2" } };

let repo: SavedResultRepository;

beforeEach(() => {
  auth.mockReset().mockResolvedValue(SESSION);
  searchAddress.mockReset().mockResolvedValue([OTHER_ADDRESS, ADDRESS]);
  collectPublicInputs.mockReset().mockResolvedValue(PUBLIC_INPUTS);
  vi.stubEnv("RESULT_SIGNING_SECRET", "test-result-signing-secret-0123456789abcdef");
  repo = createMemorySavedResultRepository();
  repoRef.current = repo;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

// 서버 판정을 실제로 한 번 돌려 결과와 저장 토큰을 받는다.
async function judged() {
  const result = await runCheckAction(checkPayload());
  if (!result.ok || result.saveToken === null) throw new Error("판정 실패");
  return { view: result.view, token: result.saveToken };
}

async function savedItems(userId = USER_ID) {
  return (await repo.listByUser(userId, { limit: 100 })).items;
}

// 토큰 본문(서명 앞부분)을 바꾼 토큰. 서명은 그대로 둔다.
function tamper(token: string, mutate: (body: { result: { report: { signalCount: number; headline: string } } }) => void) {
  const [body, signature] = token.split(".");
  const decoded = JSON.parse(Buffer.from(body!, "base64url").toString("utf8"));
  mutate(decoded);
  return `${Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url")}.${signature}`;
}

describe("saveResultAction", () => {
  it("세션이 없으면 unauthorized이고 저장하지 않는다", async () => {
    const { token } = await judged();
    auth.mockResolvedValue(null);

    expect(await saveResultAction({ token })).toEqual({ ok: false, error: "unauthorized" });
    expect(await savedItems()).toEqual([]);
  });

  it("서버 판정 결과·입력·기준일을 그대로 저장한다", async () => {
    const { view, token } = await judged();

    const saved = await saveResultAction({ token });

    if (!saved.ok) throw new Error(`실패: ${saved.error}`);
    const record = await repo.getForUser(USER_ID, saved.id);
    expect(record?.result).toEqual(view);
    expect(record?.input).toEqual({
      address: { display: ADDRESS.roadAddress, dong: "1동", ho: "201호" },
      houseType: "row-house",
      deposit: 150_000_000,
      exclusiveArea: 59.8,
      rights: view.rights,
    });
    expect(record?.dataBaseDate).toEqual(PUBLIC_INPUTS.dataBaseDate);
    expect(await savedItems()).toEqual([
      expect.objectContaining({ id: saved.id, addressDisplay: ADDRESS.roadAddress, signalCount: view.report.signalCount }),
    ]);
  });

  it("클라이언트가 결과를 조작하면(신호 0개) invalid이고 저장하지 않는다", async () => {
    // 위반건축물이면 위험 신호가 하나 이상 나온다
    collectPublicInputs.mockResolvedValue({ ...PUBLIC_INPUTS, building: { ...PUBLIC_INPUTS.building, isViolation: true } });
    const { view, token } = await judged();
    expect(view.report.signalCount).toBeGreaterThan(0);
    const tampered = tamper(token, (body) => {
      body.result.report.signalCount = 0;
      body.result.report.headline = "위험 신호 0개";
    });

    expect(await saveResultAction({ token: tampered })).toEqual({ ok: false, error: "invalid" });
    expect(await savedItems()).toEqual([]);
  });

  it("토큰 없이 보낸 결과 JSON은 저장하지 않는다", async () => {
    const { view } = await judged();

    expect(await saveResultAction({ result: { ...view, report: { ...view.report, signalCount: 0 } } })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(await savedItems()).toEqual([]);
  });

  it.each([
    ["payload가 없음", undefined],
    ["payload가 문자열", "token"],
    ["token이 숫자", { token: 1 }],
    ["token 형식 오류", { token: "not-a-token" }],
  ])("%s이면 invalid", async (_, payload) => {
    expect(await saveResultAction(payload)).toEqual({ ok: false, error: "invalid" });
    expect(await savedItems()).toEqual([]);
  });

  it("다른 사용자의 판정 토큰으로는 저장하지 않는다", async () => {
    const { token } = await judged();
    auth.mockResolvedValue(OTHER_SESSION);

    expect(await saveResultAction({ token })).toEqual({ ok: false, error: "invalid" });
    expect(await savedItems(OTHER_SESSION.user.id)).toEqual([]);
  });

  it("토큰 유효 시간이 지나면 invalid", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T00:00:00Z"));
    const { token } = await judged();
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));

    expect(await saveResultAction({ token })).toEqual({ ok: false, error: "invalid" });
  });

  it(`사용자당 ${MAX_SAVED_PER_USER}개를 넘으면 limit`, async () => {
    const { token } = await judged();
    for (let i = 0; i < MAX_SAVED_PER_USER; i += 1) {
      const result = await saveResultAction({ token });
      expect(result.ok).toBe(true);
    }

    expect(await saveResultAction({ token })).toEqual({ ok: false, error: "limit" });
    expect(await savedItems()).toHaveLength(MAX_SAVED_PER_USER);
  });

  it("저장소 오류는 failed로 바꾸고 메시지를 싣지 않는다", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { token } = await judged();
    repo.create = vi.fn().mockRejectedValue(new Error("connection refused postgres://user:SECRET@db"));

    const result = await saveResultAction({ token });

    expect(result).toEqual({ ok: false, error: "failed" });
    expect(JSON.stringify(result)).not.toContain("SECRET");
    consoleError.mockRestore();
  });

  it("서명 비밀값이 없으면 failed", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { token } = await judged();
    vi.stubEnv("RESULT_SIGNING_SECRET", "");

    expect(await saveResultAction({ token })).toEqual({ ok: false, error: "failed" });
    consoleError.mockRestore();
  });
});
