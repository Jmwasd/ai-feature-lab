import 'server-only';

import OpenAI, { APIConnectionError, APIConnectionTimeoutError, APIError } from "openai";

import { OPENAI_MODEL, OPENAI_REASONING_EFFORT } from "@/lib/constants";
import { batchRequirements } from "@/lib/requirement-batches";
import {
  parseRequirements,
  parseVerdicts,
  REQUIREMENTS_SCHEMA,
  VERDICTS_SCHEMA,
} from "@/lib/schemas";
import { unjudgedRequirementIds } from "@/lib/verdicts";
import { buildExtractRequirementsPrompt } from "@/prompts/extract-requirements";
import { buildMatchVerdictsPrompt } from "@/prompts/match-verdicts";
import type { Requirement, ResumeEvidence, Verdict } from "@/types";
import { createDeadline, OPENAI_CALL_TIMEOUT_MS, withAbort } from "./request-control";

/** 테스트에서 주입한다. 실제 구현은 OpenAI SDK를 부른다 */
export interface StructuredCaller {
  call(args: {
    prompt: string;
    schemaName: string;
    schema: Record<string, unknown>;
    callId?: string;
    signal?: AbortSignal;
  }): Promise<unknown>;
}

export interface LlmDeps {
  caller?: StructuredCaller;
  requestId?: string;
  signal?: AbortSignal;
}

function defaultCaller(requestId = "standalone"): StructuredCaller {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required environment variable: OPENAI_API_KEY");
  }

  // SDK의 숨은 재시도 대신 호출 종료 시한을 사용한다. 누락 판정만 명시적으로 재시도한다.
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: OPENAI_CALL_TIMEOUT_MS });

  return {
    async call({ prompt, schemaName, schema, callId = schemaName, signal }) {
      const started = performance.now();
      let status = "error";
      let usage: OpenAI.Responses.ResponseUsage | undefined;
      try {
        signal?.throwIfAborted();
        // 스트리밍으로 받는다. 비스트리밍 요청은 생성이 끝나야 헤더가 오는데,
        // Node fetch가 헤더를 300초까지만 기다려서 긴 판정이 SDK 타임아웃과 무관하게 끊긴다
        const stream = client.responses.stream({
          model: OPENAI_MODEL,
          input: prompt,
          store: false,
          reasoning: { effort: OPENAI_REASONING_EFFORT },
          text: {
            format: {
              type: "json_schema",
              name: schemaName,
              schema,
              strict: true,
            },
          },
        }, { signal });
        const response = await withAbort(stream.finalResponse(), signal);
        usage = response.usage;
        if (response.status === "incomplete" || response.status === "failed") {
          throw new Error("OpenAI가 응답 생성을 완료하지 못했습니다");
        }
        status = "ok";
        return response.output_text;
      } finally {
        console.info(`[analyze:${requestId}] openai`, {
          call: callId,
          status,
          durationMs: Math.round(performance.now() - started),
          model: OPENAI_MODEL,
          reasoningEffort: OPENAI_REASONING_EFFORT,
          ...(usage ? {
            inputTokens: usage.input_tokens,
            cachedInputTokens: usage.input_tokens_details.cached_tokens,
            outputTokens: usage.output_tokens,
            reasoningTokens: usage.output_tokens_details.reasoning_tokens,
          } : {}),
        });
      }
    },
  };
}

const API_KEY_PATTERN = /sk-[A-Za-z0-9_*-]+/g;

/** 로그와 화면에 남길 실패 원인. API 오류 본문은 키 일부를 되돌려주므로 담지 않는다 */
export function describeLlmError(error: unknown): string {
  if (error instanceof Error && error.name === "TimeoutError") return error.message;
  if (error instanceof Error && error.name === "AbortError") return "분석 요청이 취소되었습니다";
  if (error instanceof APIConnectionTimeoutError) {
    return "OpenAI 응답 시간 초과";
  }

  if (error instanceof APIConnectionError) {
    return "OpenAI 연결 실패";
  }

  if (error instanceof APIError) {
    return `OpenAI API 오류 (HTTP ${error.status ?? "-"}${error.code ? ` ${error.code}` : ""})`;
  }

  if (error instanceof Error) {
    return error.message.replace(API_KEY_PATTERN, "sk-***");
  }

  return "알 수 없는 오류";
}

function callerFrom(deps?: LlmDeps): StructuredCaller {
  const caller = deps?.caller ?? defaultCaller(deps?.requestId);
  return {
    async call(args) {
      const deadline = createDeadline(OPENAI_CALL_TIMEOUT_MS, deps?.signal, "OpenAI 응답 시간 초과");
      try {
        deadline.signal.throwIfAborted();
        return await withAbort(caller.call({ ...args, signal: deadline.signal }), deadline.signal);
      } finally {
        deadline.dispose();
      }
    },
  };
}

export async function extractRequirements(
  postingText: string,
  deps?: LlmDeps,
): Promise<{ requirements: Requirement[]; errors: string[] }> {
  const raw = await callerFrom(deps).call({
    prompt: buildExtractRequirementsPrompt(postingText),
    schemaName: "job_requirements",
    schema: REQUIREMENTS_SCHEMA,
  });
  const parsed = parseRequirements(raw);

  return { requirements: parsed.items, errors: parsed.errors };
}

async function matchBatch(
  requirements: Requirement[],
  evidence: ResumeEvidence[],
  caller: StructuredCaller,
  callId: string,
): Promise<{ verdicts: Verdict[]; errors: string[] }> {
  const firstRaw = await caller.call({
    prompt: buildMatchVerdictsPrompt(requirements, evidence),
    schemaName: "job_verdicts",
    schema: VERDICTS_SCHEMA,
    callId,
  });
  const first = parseVerdicts(firstRaw);
  // 다른 묶음의 판정이 섞여도 그 묶음의 실제 응답을 덮어쓰지 않게 한다.
  const targetIds = new Set(requirements.map(({ id }) => id));
  first.items = first.items.filter(({ requirementId }) => targetIds.has(requirementId));
  const missingIds = unjudgedRequirementIds(requirements, first.items);

  if (missingIds.length === 0) {
    return { verdicts: first.items, errors: first.errors };
  }

  try {
    const retryRaw = await caller.call({
      prompt: buildMatchVerdictsPrompt(requirements, evidence, missingIds),
      schemaName: "job_verdicts",
      schema: VERDICTS_SCHEMA,
      callId: `${callId}_retry`,
    });
    const retry = parseVerdicts(retryRaw);
    const missingIdSet = new Set(missingIds);
    const retryItems = retry.items.filter(
      ({ requirementId }) => missingIdSet.has(requirementId),
    );

    return {
      verdicts: [...first.items, ...retryItems],
      errors: [...first.errors, ...retry.errors],
    };
  } catch (error) {
    if (first.items.length === 0) throw error;
    return {
      verdicts: first.items,
      errors: [...first.errors, `${callId} 누락 재시도 실패: ${describeLlmError(error)}`],
    };
  }
}

export async function matchVerdicts(
  requirements: Requirement[],
  evidence: ResumeEvidence[],
  deps?: LlmDeps,
): Promise<{ verdicts: Verdict[]; errors: string[] }> {
  const batches = batchRequirements(requirements);
  if (batches.length === 0) return { verdicts: [], errors: [] };

  const caller = callerFrom(deps);
  console.info(`[analyze:${deps?.requestId ?? "standalone"}] matching`, {
    requirementCount: requirements.length,
    evidenceCount: evidence.length,
    batchSizes: batches.map((batch) => batch.length),
  });
  // 묶음 개수와 동시 실행 수를 분리한다. 취소되면 대기 중인 묶음은 시작하지 않는다.
  const results: PromiseSettledResult<Awaited<ReturnType<typeof matchBatch>>>[] = new Array(batches.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(3, batches.length) }, async () => {
    while (next < batches.length) {
      const index = next++;
      try {
        deps?.signal?.throwIfAborted();
        results[index] = {
          status: "fulfilled",
          value: await matchBatch(batches[index], evidence, caller, `match_${index + 1}`),
        };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }));

  const verdicts: Verdict[] = [];
  const errors: string[] = [];
  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") {
      verdicts.push(...result.value.verdicts);
      errors.push(...result.value.errors);
    } else {
      errors.push(`match_${index + 1} 호출 실패: ${describeLlmError(result.reason)}`);
    }
  }

  // 판정이 하나도 없고 API 실패가 있으면 오류로 응답하고, 일부 성공이면 나머지만 판정 없음으로 남긴다.
  const failure = results.find((result) => result.status === "rejected");
  if (verdicts.length === 0 && failure?.status === "rejected") throw failure.reason;
  return { verdicts, errors };
}
