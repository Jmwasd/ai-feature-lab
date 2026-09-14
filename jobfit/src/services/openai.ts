import 'server-only';

import OpenAI from "openai";

import { OPENAI_MODEL } from "@/lib/constants";
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
      const response = await client.responses.create({
        model: OPENAI_MODEL,
        input: prompt,
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            schema,
            strict: true,
          },
        },
      });

      return response.output_text;
    },
  };
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
