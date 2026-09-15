import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/services/notion", () => ({ getResumeEvidence: vi.fn() }));
vi.mock("@/services/openai", () => ({
  extractRequirements: vi.fn(),
  matchVerdicts: vi.fn(),
  describeLlmError: (error: Error) => error.message,
}));
vi.mock("@/services/posting", () => ({ fetchPosting: vi.fn(), postingFromPastedText: vi.fn() }));

import { getResumeEvidence } from "@/services/notion";
import { extractRequirements, matchVerdicts } from "@/services/openai";
import { fetchPosting, postingFromPastedText } from "@/services/posting";
import type { Requirement, ResumeEvidence } from "@/types";
import { POST } from "./route";

const evidence: ResumeEvidence[] = [{
  blockId: "block-1", text: "private resume", company: "회사", project: "프로젝트",
}];
const requirements: Requirement[] = [{ id: "req-1", text: "TypeScript 경험", kind: "must" }];
const extraction = { requirements, errors: [] };
const posting = { ok: true as const, posting: { rawText: "private posting" }, title: "공고" };

function request(body: unknown = { text: "private posting" }): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(postingFromPastedText).mockReturnValue(posting);
  vi.mocked(fetchPosting).mockResolvedValue(posting);
  vi.mocked(getResumeEvidence).mockResolvedValue(evidence);
  vi.mocked(extractRequirements).mockResolvedValue(extraction);
  vi.mocked(matchVerdicts).mockResolvedValue({
    verdicts: [{ requirementId: "req-1", bucket: "covered", confidence: 0.9, evidenceBlockIds: ["block-1"] }],
    errors: [],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("POST /api/analyze", () => {
  it("uses one analysis deadline across stages and returns completed verdicts on expiry", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const expanded = [...requirements, { id: "req-2", text: "다른 경험", kind: "nice" as const }];
    vi.mocked(extractRequirements).mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve({ requirements: expanded, errors: [] }), 40_000);
    }));
    vi.mocked(matchVerdicts).mockImplementation((_requirements, _evidence, deps) => new Promise((resolve) => {
      deps?.signal?.addEventListener("abort", () => resolve({
        verdicts: [{ requirementId: "req-1", bucket: "covered", confidence: 0.9, evidenceBlockIds: ["block-1"] }],
        errors: ["시간 초과"],
      }), { once: true });
    }));
    const pending = POST(request());
    await vi.advanceTimersByTimeAsync(120_000);
    const response = await pending;
    expect(response.status).toBe(200);
    expect(response.headers.get("Server-Timing")).toContain("total;dur=120000");
    expect(await response.json()).toMatchObject({
      status: "ok", result: { covered: [{ requirement: { id: "req-1" } }], unjudged: [{ requirement: { id: "req-2" } }], missing: [] },
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns a timeout error when the analysis expires without completed verdicts", async () => {
    vi.useFakeTimers();
    vi.mocked(matchVerdicts).mockImplementation((_requirements, _evidence, deps) => new Promise((_resolve, reject) => {
      deps?.signal?.addEventListener("abort", () => reject(deps.signal?.reason), { once: true });
    }));
    const pending = POST(request());
    await vi.advanceTimersByTimeAsync(120_000);
    const response = await pending;
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ status: "error", message: expect.stringContaining("초과") });
  });

  it("starts extraction while Notion is pending and waits for both before matching", async () => {
    const resume = deferred<ResumeEvidence[]>();
    const extract = deferred<typeof extraction>();
    vi.mocked(getResumeEvidence).mockReturnValue(resume.promise);
    vi.mocked(extractRequirements).mockReturnValue(extract.promise);

    const pending = POST(request());
    await vi.waitFor(() => expect(extractRequirements).toHaveBeenCalledOnce());
    expect(getResumeEvidence).toHaveBeenCalledOnce();
    expect(matchVerdicts).not.toHaveBeenCalled();
    extract.resolve(extraction);
    await Promise.resolve();
    expect(matchVerdicts).not.toHaveBeenCalled();
    resume.resolve(evidence);

    const response = await pending;
    const requestId = response.headers.get("X-Request-Id");
    expect(requestId).toBeTruthy();
    expect(matchVerdicts).toHaveBeenCalledWith(requirements, evidence, { requestId, signal: expect.any(AbortSignal) });
    expect(extractRequirements).toHaveBeenCalledWith("private posting", { requestId, signal: expect.any(AbortSignal) });
    expect(await response.json()).toMatchObject({ status: "ok", result: { covered: [{ evidence }] } });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("reports overlapping stage times and total duration through Server-Timing", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const later = <T>(value: T, ms: number) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
    vi.mocked(fetchPosting).mockImplementation(() => later(posting, 2000));
    vi.mocked(getResumeEvidence).mockImplementation(() => later(evidence, 8000));
    vi.mocked(extractRequirements).mockImplementation(() => later(extraction, 12000));
    vi.mocked(matchVerdicts).mockImplementation(() => later({ verdicts: [], errors: [] }, 18000));

    const pending = POST(request({ url: "https://example.com/job" }));
    await vi.runAllTimersAsync();
    const response = await pending;
    const timing = response.headers.get("Server-Timing");
    expect(timing).toContain("posting;dur=2000");
    expect(timing).toContain("notion;dur=8000");
    expect(timing).toContain("extraction;dur=12000");
    expect(timing).toContain("matching;dur=18000");
    expect(timing).toContain("total;dur=32000");
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain("private");
  });

  it("does not start Notion or OpenAI when the posting requires a paste fallback", async () => {
    vi.mocked(fetchPosting).mockResolvedValue({ ok: false, reason: "too-short", message: "본문을 붙여넣어 주세요" });
    const response = await POST(request({ url: "https://example.com/job" }));
    expect(await response.json()).toMatchObject({ status: "needs-paste" });
    expect(getResumeEvidence).not.toHaveBeenCalled();
    expect(extractRequirements).not.toHaveBeenCalled();
    expect(response.headers.get("Server-Timing")).toContain("total;dur=");
  });

  it.each(["notion", "extraction"])("keeps the correct error when %s fails", async (stage) => {
    if (stage === "notion") vi.mocked(getResumeEvidence).mockRejectedValue(new Error("notion unavailable"));
    else vi.mocked(extractRequirements).mockRejectedValue(new Error("extraction unavailable"));

    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ status: "error", message: expect.stringContaining(`${stage} unavailable`) });
    expect(matchVerdicts).not.toHaveBeenCalled();
    expect(response.headers.get("Server-Timing")).toContain("total;dur=");
  });

  it("handles both preparation failures without an unhandled rejection", async () => {
    vi.mocked(getResumeEvidence).mockRejectedValue(new Error("notion unavailable"));
    vi.mocked(extractRequirements).mockRejectedValue(new Error("extraction unavailable"));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ message: expect.stringContaining("notion unavailable") });
    expect(matchVerdicts).not.toHaveBeenCalled();
  });

  it.each(["notion", "extraction"])("skips matching when %s returns no items", async (stage) => {
    if (stage === "notion") vi.mocked(getResumeEvidence).mockResolvedValue([]);
    else vi.mocked(extractRequirements).mockResolvedValue({ requirements: [], errors: [] });
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(matchVerdicts).not.toHaveBeenCalled();
  });

  it("leaves failed matching items unjudged while keeping successful items", async () => {
    vi.mocked(extractRequirements).mockResolvedValue({
      requirements: [...requirements, { id: "req-2", text: "다른 경험", kind: "nice" }], errors: [],
    });
    const response = await POST(request());
    expect(await response.json()).toMatchObject({
      status: "ok", result: { covered: [{ requirement: { id: "req-1" } }], unjudged: [{ requirement: { id: "req-2" } }], missing: [] },
    });
  });
});
