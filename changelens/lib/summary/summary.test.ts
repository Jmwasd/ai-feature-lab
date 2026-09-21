import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CommitNotFoundError } from "@/lib/git";
import { createGitFixture, type GitFixture } from "@/tests/helpers/git-fixture";
import { readCachedSummary, writeCachedSummary } from "./cache";
import { summarizeCommit } from "./index";

const sdk = vi.hoisted(() => ({ construct: vi.fn(), create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  return { ...actual, default: class extends actual.default {
    constructor(options: ConstructorParameters<typeof actual.default>[0]) {
      super(options);
      sdk.construct(options);
      this.messages.create = sdk.create;
    }
  } };
});

const output = { summary: "문서에 한글 내용을 추가했다.", points: ["설명 추가", "파일 생성", "내용 기록", "생략할 항목"] };
const ok = { status: "ok" as const, summary: output.summary, points: output.points.slice(0, 3), truncated: false };
function response(text = JSON.stringify(output), stop_reason: Anthropic.Message["stop_reason"] = "end_turn") {
  return { stop_reason, content: [
    { type: "thinking" as const, thinking: "검토", signature: "test" },
    { type: "text" as const, text, citations: [] },
  ] };
}
const create = vi.fn<(params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Pick<Anthropic.Message, "content" | "stop_reason">>>();
const client = { messages: { create } };
let repo: GitFixture;
let sha: string;
let largeSha: string;
let cacheRoot: string;
let count = 0;
function cacheFile(repoPath = repo.path) {
  const hash = createHash("sha256").update(resolve(repoPath)).digest("hex").slice(0, 16);
  return join(cacheRoot, hash, `${sha}.json`);
}

beforeAll(async () => {
  repo = await createGitFixture();
  await repo.write("문서.txt", "한글 내용\n");
  sha = await repo.commit("feat: 문서\n\n여러 줄 설명\n\t마지막 줄\n");
  await repo.write("large.txt", "가".repeat(100_000));
  largeSha = await repo.commit("feat: 큰 파일");
}, 30_000);
beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key-never-sent");
  cacheRoot = join(repo.root, `cache-${++count}`);
  create.mockReset().mockResolvedValue(response());
  sdk.create.mockReset().mockResolvedValue(response());
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await repo?.cleanup();
});

describe("summarizeCommit with real git and an isolated cache", () => {
  it.each([undefined, ""])("returns disabled without touching git, cache or client for key %s", async (key) => {
    vi.stubEnv("ANTHROPIC_API_KEY", key);
    const deps = { client, get cacheRoot(): string { throw new Error("Cache must not be touched"); } };
    expect(await summarizeCommit("missing-repo", sha, deps)).toEqual({ status: "disabled" });
    expect(create).not.toHaveBeenCalled();
    expect(sdk.construct).not.toHaveBeenCalled();
  });

  it("parses the text after thinking, caps points at three and writes the full-SHA cache", async () => {
    expect(await summarizeCommit(repo.path, sha.slice(0, 7), { client, cacheRoot })).toEqual(ok);
    expect(JSON.parse(await readFile(cacheFile(), "utf8"))).toEqual(ok);
    expect(await readdir(join(cacheFile(), ".."))).toEqual([`${sha}.json`]);
    const params = create.mock.calls[0][0];
    expect(params).toMatchObject({ model: "claude-sonnet-5", max_tokens: 4096 });
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(params.output_config).toEqual({ effort: "low", format: { type: "json_schema", schema: {
      type: "object", properties: { summary: { type: "string" }, points: { type: "array", items: { type: "string" } } },
      required: ["summary", "points"], additionalProperties: false,
    } } });
    expect(JSON.stringify(params)).not.toContain("budget_tokens");
    expect(params.messages).toHaveLength(1);
    expect(params.messages[0].role).toBe("user");
    expect(params.messages[0].content).toContain("여러 줄 설명\n\t마지막 줄");
    expect(params.messages[0].content).toContain("1\t0\t문서.txt");
    expect(params.messages[0].content).toContain("+한글 내용");
    expect(params.system).toContain("한국어 평서문");
    expect(params.system).toContain("한 문단");
    expect(params.system).toContain("추측하지");
  });

  it("reuses a full-SHA cache for short and full requests, including a relative repo path", async () => {
    await summarizeCommit(repo.path, sha, { client, cacheRoot });
    create.mockClear();
    expect(await summarizeCommit(relative(process.cwd(), repo.path), sha.slice(0, 8), { client, cacheRoot })).toEqual(ok);
    expect(await summarizeCommit(repo.path, sha, { client, cacheRoot })).toEqual(ok);
    expect(create).not.toHaveBeenCalled();
  });

  it("does not return a cached summary when the key is removed", async () => {
    await summarizeCommit(repo.path, sha, { client, cacheRoot });
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
    create.mockClear();
    expect(await summarizeCommit(repo.path, sha, { client, cacheRoot })).toEqual({ status: "disabled" });
    expect(create).not.toHaveBeenCalled();
  });

  it("propagates truncation into both the prompt and cached result", async () => {
    const result = await summarizeCommit(repo.path, largeSha, { client, cacheRoot });
    expect(result).toEqual({ ...ok, truncated: true });
    expect(create.mock.calls[0][0].messages[0].content).toContain("diff가 잘렸다");
    expect(await readCachedSummary(cacheRoot, repo.path, largeSha)).toEqual(result);
  });

  it.each([
    ["refusal", "{", "refusal"], ["max_tokens", JSON.stringify(output), "failed"],
    ["end_turn", "{", "failed"], ["end_turn", "null", "failed"],
    ["end_turn", '{"summary":3,"points":[]}', "failed"],
    ["end_turn", '{"summary":"text","points":[1]}', "failed"],
  ] as const)("returns %s / %s as %s without caching", async (stop, text, reason) => {
    create.mockResolvedValue(response(text, stop));
    expect(await summarizeCommit(repo.path, sha, { client, cacheRoot })).toEqual({ status: "error", reason });
    await expect(readFile(cacheFile())).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("treats a response without text as failed", async () => {
    create.mockResolvedValue({ stop_reason: "end_turn", content: [] });
    expect(await summarizeCommit(repo.path, sha, { client, cacheRoot })).toEqual({ status: "error", reason: "failed" });
    await expect(readFile(cacheFile())).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([
    [new Anthropic.AuthenticationError(401, {}, "same message", new Headers()), "auth"],
    [new Anthropic.RateLimitError(429, {}, "same message", new Headers()), "rate-limit"],
    [new Anthropic.APIConnectionTimeoutError(), "failed"],
    [new Anthropic.APIConnectionError({ message: "same message" }), "failed"],
    [new Anthropic.APIError(500, {}, "same message", new Headers()), "failed"],
    [new Error("test-key-never-sent"), "failed"],
  ] as const)("classifies SDK error %# without caching or leaking details", async (error, reason) => {
    create.mockRejectedValue(error);
    expect(await summarizeCommit(repo.path, sha, { client, cacheRoot })).toEqual({ status: "error", reason });
    await expect(readFile(cacheFile())).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves missing-commit errors for the route's 404", async () => {
    await expect(summarizeCommit(repo.path, "0".repeat(40), { client, cacheRoot })).rejects.toBeInstanceOf(CommitNotFoundError);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns failed for other git errors without calling the API", async () => {
    expect(await summarizeCommit(join(repo.root, "missing"), sha, { client, cacheRoot })).toEqual({ status: "error", reason: "failed" });
    expect(create).not.toHaveBeenCalled();
  });

  it("treats corrupt or unreadable cache entries as misses", async () => {
    await mkdir(join(cacheFile(), ".."), { recursive: true });
    await writeFile(cacheFile(), "{");
    expect(await readCachedSummary(cacheRoot, repo.path, sha)).toBeNull();
    expect(await summarizeCommit(repo.path, sha, { client, cacheRoot })).toEqual(ok);
    expect(create).toHaveBeenCalledOnce();
    expect(await readCachedSummary(join(repo.root, "missing"), repo.path, sha)).toBeNull();
  });

  it("keeps a successful result when cache writes fail", async () => {
    await writeFile(cacheRoot, "this is a file, not a directory");
    expect(await summarizeCommit(repo.path, sha, { client, cacheRoot })).toEqual(ok);
  });

  it("isolates caches by the absolute repository path", async () => {
    await writeCachedSummary(cacheRoot, repo.path, sha, ok);
    expect(await readCachedSummary(cacheRoot, relative(process.cwd(), repo.path), sha)).toEqual(ok);
    expect(await readCachedSummary(cacheRoot, join(repo.root, "another-repo"), sha)).toBeNull();
  });

  it("constructs the default SDK lazily with a 30-second timeout and one retry", async () => {
    expect(sdk.construct).not.toHaveBeenCalled();
    expect(await summarizeCommit(repo.path, sha, { cacheRoot })).toEqual(ok);
    expect(sdk.construct).toHaveBeenCalledExactlyOnceWith({ timeout: 30_000, maxRetries: 1 });
    expect(sdk.create).toHaveBeenCalledOnce();
  });
});
