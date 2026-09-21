import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolve } from "node:path";
import { CommitNotFoundError } from "@/lib/git";
import { summarizeCommit } from "@/lib/summary";
import { GET } from "./route";

vi.mock("@/lib/summary", () => ({ summarizeCommit: vi.fn() }));
const sha = "a".repeat(40);
const call = (value = sha) => GET(new Request(`http://localhost:3000/api/summary/${value}`), {
  params: Promise.resolve({ sha: value }),
});
beforeEach(() => {
  vi.stubEnv("CHANGELENS_REPO", "./test-repo");
  vi.mocked(summarizeCommit).mockReset().mockResolvedValue({ status: "disabled" });
});
afterEach(() => vi.unstubAllEnvs());

describe("summary GET route", () => {
  it.each(["HEAD", "-abcdef", "abcdef", "A".repeat(40), "a".repeat(41), "abcdefg", "abcdef1\n"])("rejects invalid SHA %j before summarizing", async (value) => {
    expect((await call(value)).status).toBe(400);
    expect(summarizeCommit).not.toHaveBeenCalled();
  });

  it.each([
    { status: "disabled" },
    { status: "ok", summary: "변경했다.", points: ["내용 추가"], truncated: true },
    { status: "error", reason: "auth" },
    { status: "error", reason: "rate-limit" },
    { status: "error", reason: "refusal" },
    { status: "error", reason: "failed" },
  ] as const)("returns 200 with summary result %j", async (result) => {
    vi.mocked(summarizeCommit).mockResolvedValue({ ...result, ...("points" in result ? { points: [...result.points] } : {}) });
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(summarizeCommit).toHaveBeenCalledWith(resolve("./test-repo"), sha);
  });

  it("accepts a short SHA and falls back to cwd", async () => {
    vi.stubEnv("CHANGELENS_REPO", undefined);
    expect((await call("abcdef1")).status).toBe(200);
    expect(summarizeCommit).toHaveBeenCalledWith(process.cwd(), "abcdef1");
  });

  it("returns 404 for a missing commit", async () => {
    vi.mocked(summarizeCommit).mockRejectedValue(new CommitNotFoundError(sha));
    expect((await call()).status).toBe(404);
  });

  it("returns a failed result for unexpected errors without exposing details", async () => {
    vi.mocked(summarizeCommit).mockRejectedValue(new Error("private path or key"));
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "error", reason: "failed" });
  });
});
