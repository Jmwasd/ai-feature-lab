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
  it("does not retry when every requirement is judged", async () => {
    const { caller, call } = fakeCaller({
      verdicts: requirements.map(({ id }) => verdict(id)),
    });

    const result = await matchVerdicts(requirements, evidence, { caller });

    expect(result.verdicts).toHaveLength(3);
    expect(result.errors).toEqual([]);
    expect(call).toHaveBeenCalledOnce();
    expect(call).toHaveBeenCalledWith({
      prompt: expect.any(String),
      schemaName: "job_verdicts",
      schema: VERDICTS_SCHEMA,
    });
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
  });

  afterEach(() => {
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
