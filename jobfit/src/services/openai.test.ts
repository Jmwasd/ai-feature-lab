import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { responsesStream } = vi.hoisted(() => ({
  responsesStream: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("openai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("openai")>()),
  default: class {
    responses = { stream: responsesStream };
  },
}));

import { APIConnectionError, APIConnectionTimeoutError, APIError } from "openai";

import { OPENAI_MODEL, OPENAI_REASONING_EFFORT } from "@/lib/constants";
import { REQUIREMENTS_SCHEMA, VERDICTS_SCHEMA } from "@/lib/schemas";
import type { Requirement, ResumeEvidence, Verdict } from "@/types";

import {
  describeLlmError,
  extractRequirements,
  matchVerdicts,
  type StructuredCaller,
} from "./openai";

const requirements: Requirement[] = [
  { id: "req-1", text: "TypeScript 경험", kind: "must" },
  { id: "req-2", text: "CI/CD 구축 경험", kind: "must" },
  { id: "req-3", text: "Kubernetes 경험", kind: "nice" },
];

const evidence: ResumeEvidence[] = [
  {
    blockId: "block-1",
    text: "TypeScript로 백엔드 서비스를 개발했다.",
    company: "회사",
    project: "프로젝트",
  },
];

function verdict(
  requirementId: string,
  bucket: Verdict["bucket"] = "covered",
): Record<string, unknown> {
  return {
    requirementId,
    bucket,
    evidenceBlockIds: bucket === "missing" ? [] : ["block-1"],
    confidence: 0.9,
    suggestion: null,
    suggestionEvidenceBlockIds: null,
  };
}

function fakeCaller(...responses: unknown[]): {
  caller: StructuredCaller;
  call: ReturnType<typeof vi.fn<StructuredCaller["call"]>>;
} {
  const call = vi.fn<StructuredCaller["call"]>();
  for (const response of responses) {
    call.mockResolvedValueOnce(response);
  }

  return { caller: { call }, call };
}

function promptRequirements(prompt: string): Requirement[] {
  return JSON.parse(prompt.split("<requirements>\n")[1].split("\n</requirements>")[0]);
}

const manyRequirements: Requirement[] = Array.from({ length: 12 }, (_, index) => ({
  id: `req-${index + 1}`,
  text: `요구사항 ${index + 1}`,
  kind: "must",
}));

describe("extractRequirements", () => {
  it("returns parsed requirements from a structured response", async () => {
    const { caller, call } = fakeCaller({
      requirements: [
        {
          id: "req-1",
          text: "TypeScript 경험",
          kind: "must",
          requiredMonths: null,
        },
      ],
    });

    await expect(
      extractRequirements("TypeScript 개발자를 찾습니다.", { caller }),
    ).resolves.toEqual({
      requirements: [requirements[0]],
      errors: [],
    });
    expect(call).toHaveBeenCalledOnce();
    expect(call).toHaveBeenCalledWith({
      prompt: expect.stringContaining("TypeScript 개발자를 찾습니다."),
      schemaName: "job_requirements",
      schema: REQUIREMENTS_SCHEMA,
      signal: expect.any(AbortSignal),
    });
  });

  it("drops only invalid items and preserves parse errors", async () => {
    const { caller } = fakeCaller({
      requirements: [
        {
          id: "req-1",
          text: "TypeScript 경험",
          kind: "must",
          requiredMonths: null,
        },
        {
          id: "broken",
          text: "",
          kind: "must",
          requiredMonths: null,
        },
      ],
    });

    const result = await extractRequirements("공고 본문", { caller });

    expect(result.requirements).toEqual([requirements[0]]);
    expect(result.errors).toEqual([
      "requirements[1] (broken): text가 비어 있거나 문자열이 아닙니다.",
    ]);
  });
});

describe("matchVerdicts", () => {
  it("processes more than three batches without exceeding three concurrent calls", async () => {
    const input = Array.from({ length: 20 }, (_, index) => ({ id: `req-${index + 1}`, text: "요건", kind: "must" as const }));
    let active = 0;
    let peak = 0;
    const complete: Array<() => void> = [];
    const call = vi.fn<StructuredCaller["call"]>(({ prompt }) => {
      active++;
      peak = Math.max(peak, active);
      return new Promise((resolve) => complete.push(() => {
        active--;
        resolve({ verdicts: promptRequirements(prompt).map(({ id }) => verdict(id)) });
      }));
    });
    const pending = matchVerdicts(input, evidence, { caller: { call } });
    expect(call).toHaveBeenCalledTimes(3);
    complete[1]();
    await vi.waitFor(() => expect(call).toHaveBeenCalledTimes(4));
    complete[3]();
    await vi.waitFor(() => expect(call).toHaveBeenCalledTimes(5));
    complete[0](); complete[2](); complete[4]();
    expect((await pending).verdicts.map(({ requirementId }) => requirementId)).toEqual(input.map(({ id }) => id));
    expect(peak).toBe(3);
    expect(call.mock.calls.every(([args]) => promptRequirements(args.prompt).length <= 4)).toBe(true);
  });

  it("preserves a first pass on cancellation and never starts queued batches", async () => {
    const input = Array.from({ length: 20 }, (_, index) => ({ id: `req-${index + 1}`, text: "요건", kind: "must" as const }));
    const controller = new AbortController();
    const call = vi.fn<StructuredCaller["call"]>(({ callId }) => {
      if (callId === "match_1") return Promise.resolve({ verdicts: [verdict("req-1")] });
      return new Promise(() => {});
    });
    const pending = matchVerdicts(input, evidence, { caller: { call }, signal: controller.signal });
    await vi.waitFor(() => expect(call).toHaveBeenCalledTimes(4));
    controller.abort(new DOMException("분석 시간 초과", "TimeoutError"));
    const result = await pending;
    expect(result.verdicts.map(({ requirementId }) => requirementId)).toEqual(["req-1"]);
    expect(call).toHaveBeenCalledTimes(4);
    expect(call.mock.calls.filter(([args]) => args.callId !== "match_1").every(([args]) => args.signal?.aborted)).toBe(true);
  });

  it("runs at most three batches concurrently and merges out-of-order completions", async () => {
    const complete: Array<() => void> = [];
    const call = vi.fn<StructuredCaller["call"]>(({ prompt }) => new Promise((resolve) => {
      const targets = promptRequirements(prompt);
      complete.push(() => resolve({ verdicts: targets.map(({ id }) => verdict(id)) }));
    }));

    const pending = matchVerdicts(manyRequirements, evidence, { caller: { call } });

    expect(call).toHaveBeenCalledTimes(3);
    expect(call.mock.calls.map(([args]) => promptRequirements(args.prompt).length)).toEqual([4, 4, 4]);
    for (const [args] of call.mock.calls) {
      expect(args.prompt).toContain(evidence[0].text);
      expect(args.prompt).toContain(evidence[0].blockId);
    }
    complete[2]();
    complete[0]();
    complete[1]();

    const result = await pending;
    expect(result.verdicts.map(({ requirementId }) => requirementId)).toEqual(
      manyRequirements.map(({ id }) => id),
    );
    expect(result.errors).toEqual([]);
  });

  it("retries only omissions in the affected batch and rejects foreign batch verdicts", async () => {
    const call = vi.fn<StructuredCaller["call"]>(async ({ prompt }) => {
      const targets = promptRequirements(prompt);
      if (targets.length === 1) {
        return { verdicts: [verdict("req-4")] };
      }
      if (targets[0].id === "req-1") {
        return { verdicts: [verdict("req-1"), verdict("req-2"), verdict("req-3"), verdict("req-5", "missing")] };
      }
      return { verdicts: targets.map(({ id }) => verdict(id)) };
    });

    const result = await matchVerdicts(manyRequirements, evidence, { caller: { call } });

    expect(call).toHaveBeenCalledTimes(4);
    expect(promptRequirements(call.mock.calls[3][0].prompt).map(({ id }) => id)).toEqual(["req-4"]);
    expect(result.verdicts).toHaveLength(12);
    expect(result.verdicts.find(({ requirementId }) => requirementId === "req-5")?.bucket).toBe("covered");
  });

  it("preserves successful batches when another batch fails", async () => {
    const call = vi.fn<StructuredCaller["call"]>(async ({ prompt }) => {
      const targets = promptRequirements(prompt);
      if (targets[0].id === "req-5") throw new APIConnectionTimeoutError();
      return { verdicts: targets.map(({ id }) => verdict(id)) };
    });

    const result = await matchVerdicts(manyRequirements, evidence, { caller: { call } });

    expect(result.verdicts.map(({ requirementId }) => requirementId)).toEqual([
      "req-1", "req-2", "req-3", "req-4", "req-9", "req-10", "req-11", "req-12",
    ]);
    expect(result.errors.join(" ")).toContain("시간 초과");
    expect(call).toHaveBeenCalledTimes(3);
  });

  it("preserves first-pass verdicts when their omission retry fails", async () => {
    const { caller, call } = fakeCaller({ verdicts: [verdict("req-1")] });
    call.mockRejectedValueOnce(new APIConnectionTimeoutError());

    const result = await matchVerdicts(requirements, evidence, { caller });

    expect(result.verdicts.map(({ requirementId }) => requirementId)).toEqual(["req-1"]);
    expect(result.errors.join(" ")).toContain("시간 초과");
  });

  it("throws an API error when every batch fails", async () => {
    const failure = new APIConnectionTimeoutError();
    const call = vi.fn<StructuredCaller["call"]>().mockRejectedValue(failure);
    await expect(matchVerdicts(manyRequirements, evidence, { caller: { call } })).rejects.toBe(failure);
    expect(call).toHaveBeenCalledTimes(3);
  });

  it("does not call the API for zero requirements", async () => {
    const { caller, call } = fakeCaller();
    await expect(matchVerdicts([], evidence, { caller })).resolves.toEqual({ verdicts: [], errors: [] });
    expect(call).not.toHaveBeenCalled();
  });

  it("does not retry when every requirement is judged", async () => {
    const { caller, call } = fakeCaller({
      verdicts: requirements.map(({ id }) => verdict(id)),
    });

    const result = await matchVerdicts(requirements, evidence, { caller });

    expect(result.verdicts).toHaveLength(3);
    expect(result.errors).toEqual([]);
    expect(call).toHaveBeenCalledOnce();
    expect(call).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.any(String),
      schemaName: "job_verdicts",
      schema: VERDICTS_SCHEMA,
    }));
  });

  it("retries once with only the missing requirement ids and merges the result", async () => {
    const { caller, call } = fakeCaller(
      { verdicts: [verdict("req-1"), verdict("req-2")] },
      { verdicts: [verdict("req-3")] },
    );

    const result = await matchVerdicts(requirements, evidence, { caller });

    expect(call).toHaveBeenCalledTimes(2);
    const retryPrompt = call.mock.calls[1]?.[0].prompt ?? "";
    expect(retryPrompt).toContain('재시도 대상 requirementId만 판정하라: ["req-3"]');
    expect(retryPrompt).toContain('"id": "req-3"');
    expect(retryPrompt).not.toContain('"id": "req-1"');
    expect(retryPrompt).not.toContain('"id": "req-2"');
    expect(result.verdicts.map(({ requirementId }) => requirementId)).toEqual([
      "req-1",
      "req-2",
      "req-3",
    ]);
  });

  it("leaves a requirement unjudged when the single retry still omits it", async () => {
    const { caller, call } = fakeCaller(
      { verdicts: [verdict("req-1"), verdict("req-2")] },
      { verdicts: [verdict("req-2", "missing")] },
    );

    const result = await matchVerdicts(requirements, evidence, { caller });

    expect(call).toHaveBeenCalledTimes(2);
    expect(result.verdicts.map(({ requirementId }) => requirementId)).toEqual([
      "req-1",
      "req-2",
    ]);
    expect(result.verdicts).not.toContainEqual(
      expect.objectContaining({ requirementId: "req-3", bucket: "missing" }),
    );
  });

  it("keeps the first verdict when the retry repeats a requirement id", async () => {
    const { caller, call } = fakeCaller(
      {
        verdicts: [verdict("req-1", "covered"), verdict("req-2", "covered")],
      },
      {
        verdicts: [verdict("req-1", "missing"), verdict("req-3", "missing")],
      },
    );

    const result = await matchVerdicts(requirements, evidence, { caller });

    expect(result.verdicts).toHaveLength(3);
    expect(result.verdicts[0]).toMatchObject({
      requirementId: "req-1",
      bucket: "covered",
    });
    expect(call).toHaveBeenCalledTimes(2);
  });
});

describe("OpenAI configuration", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    responsesStream.mockReset();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });

  it("names OPENAI_API_KEY when no caller or key is configured", async () => {
    await expect(extractRequirements("공고 본문")).rejects.toThrow(
      "OPENAI_API_KEY",
    );
  });

  it("streams with OPENAI_MODEL, the shared reasoning effort and strict structured outputs", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const streamed = (payload: unknown) => ({
      finalResponse: async () => ({ output_text: JSON.stringify(payload) }),
    });
    responsesStream
      .mockReturnValueOnce(
        streamed({
          requirements: [
            {
              id: "req-1",
              text: "TypeScript 경험",
              kind: "must",
              requiredMonths: null,
            },
          ],
        }),
      )
      .mockReturnValueOnce(streamed({ verdicts: [verdict("req-1")] }));

    await expect(extractRequirements("공고 본문")).resolves.toMatchObject({
      requirements: [requirements[0]],
    });
    await expect(matchVerdicts([requirements[0]], evidence)).resolves.toMatchObject({
      verdicts: [expect.objectContaining({ requirementId: "req-1" })],
    });

    expect(responsesStream).toHaveBeenCalledTimes(2);
    for (const [request] of responsesStream.mock.calls) {
      expect(request).toMatchObject({
        model: OPENAI_MODEL,
        reasoning: { effort: OPENAI_REASONING_EFFORT },
        store: false,
        text: {
          format: {
            type: "json_schema",
            strict: true,
          },
        },
      });
    }
  });

  it("aborts the SDK stream when it stalls after receiving headers", async () => {
    vi.useFakeTimers();
    process.env.OPENAI_API_KEY = "test-key";
    let signal: AbortSignal | undefined;
    responsesStream.mockImplementation((_request, options) => {
      signal = options.signal;
      return { finalResponse: () => new Promise(() => {}) };
    });
    const pending = expect(extractRequirements("공고 본문")).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(60_000);
    await pending;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("logs timing and token counts with the analysis id, without logging prompts or outputs", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    responsesStream.mockReturnValue({
      finalResponse: async () => ({
        output_text: JSON.stringify({ requirements: [requirements[0]] }),
        usage: {
          input_tokens: 1000,
          input_tokens_details: { cached_tokens: 100 },
          output_tokens: 200,
          output_tokens_details: { reasoning_tokens: 150 },
        },
      }),
    });

    await extractRequirements("private posting text", { requestId: "analysis-test" });

    expect(console.info).toHaveBeenCalledWith("[analyze:analysis-test] openai", expect.objectContaining({
      call: "job_requirements", status: "ok", durationMs: expect.any(Number),
      inputTokens: 1000, cachedInputTokens: 100, outputTokens: 200, reasoningTokens: 150,
    }));
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain("private posting text");
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain("TypeScript 경험");
  });

  it("records the failed call duration when the stream errors", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    responsesStream.mockReturnValue({ finalResponse: async () => { throw new APIConnectionTimeoutError(); } });

    await expect(extractRequirements("private posting text", { requestId: "analysis-test" })).rejects.toThrow();
    expect(console.info).toHaveBeenCalledWith("[analyze:analysis-test] openai", expect.objectContaining({
      call: "job_requirements", status: "error", durationMs: expect.any(Number),
    }));
  });
});

describe("describeLlmError", () => {
  it("names a timeout without leaking details", () => {
    expect(describeLlmError(new APIConnectionTimeoutError())).toContain("시간 초과");
  });

  it("reports a connection failure", () => {
    expect(describeLlmError(new APIConnectionError({ message: "fetch failed" }))).toContain("연결");
  });

  it("reports HTTP status and error code but never the API message that can echo the key", () => {
    const error = new APIError(
      401,
      { code: "invalid_api_key", message: "Incorrect API key provided: sk-proj-abcd****wxyz" },
      undefined,
      new Headers(),
    );

    const description = describeLlmError(error);

    expect(description).toContain("401");
    expect(description).toContain("invalid_api_key");
    expect(description).not.toContain("sk-");
  });

  it("keeps a plain error message but redacts anything shaped like an API key", () => {
    expect(describeLlmError(new Error("Missing required environment variable: OPENAI_API_KEY"))).toContain(
      "OPENAI_API_KEY",
    );
    expect(describeLlmError(new Error("bad key sk-live-secret123"))).not.toContain("secret123");
  });
});
