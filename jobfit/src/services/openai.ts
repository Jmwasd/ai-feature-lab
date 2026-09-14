import 'server-only';

import OpenAI, { APIConnectionError, APIConnectionTimeoutError, APIError } from "openai";

import { OPENAI_MODEL, OPENAI_REASONING_EFFORT } from "@/lib/constants";
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

/** 테스트에서 주입한다. 실제 구현은 OpenAI SDK를 부른다 */
export interface StructuredCaller {
  call(args: {
    prompt: string;
    schemaName: string;
    schema: Record<string, unknown>;
  }): Promise<unknown>;
}

export interface LlmDeps {
  caller?: StructuredCaller;
}

function defaultCaller(): StructuredCaller {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required environment variable: OPENAI_API_KEY");
  }

  const client = new OpenAI({ apiKey });

  return {
    async call({ prompt, schemaName, schema }) {
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
      });
      const response = await stream.finalResponse();

      return response.output_text;
    },
  };
}

const API_KEY_PATTERN = /sk-[A-Za-z0-9_*-]+/g;

/** 로그와 화면에 남길 실패 원인. API 오류 본문은 키 일부를 되돌려주므로 담지 않는다 */
export function describeLlmError(error: unknown): string {
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
  return deps?.caller ?? defaultCaller();
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

export async function matchVerdicts(
  requirements: Requirement[],
  evidence: ResumeEvidence[],
  deps?: LlmDeps,
): Promise<{ verdicts: Verdict[]; errors: string[] }> {
  const caller = callerFrom(deps);
  const firstRaw = await caller.call({
    prompt: buildMatchVerdictsPrompt(requirements, evidence),
    schemaName: "job_verdicts",
    schema: VERDICTS_SCHEMA,
  });
  const first = parseVerdicts(firstRaw);
  const missingIds = unjudgedRequirementIds(requirements, first.items);

  if (missingIds.length === 0) {
    return { verdicts: first.items, errors: first.errors };
  }

  const retryRaw = await caller.call({
    prompt: buildMatchVerdictsPrompt(requirements, evidence, missingIds),
    schemaName: "job_verdicts",
    schema: VERDICTS_SCHEMA,
  });
  const retry = parseVerdicts(retryRaw);
  const firstIds = new Set(first.items.map(({ requirementId }) => requirementId));
  const retryItems = retry.items.filter(
    ({ requirementId }) => !firstIds.has(requirementId),
  );

  return {
    verdicts: [...first.items, ...retryItems],
    errors: [...first.errors, ...retry.errors],
  };
}
