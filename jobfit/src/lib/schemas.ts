import type {
  Requirement,
  RequirementKind,
  Verdict,
  VerdictBucket,
} from "@/types";

export const REQUIREMENTS_SCHEMA: Record<string, unknown> = {
  type: "object",
  description: "채용공고에서 추출한 요구사항 목록",
  additionalProperties: false,
  required: ["requirements"],
  properties: {
    requirements: {
      type: "array",
      description: "원자적인 채용 요구사항 목록",
      items: {
        type: "object",
        description: "채용공고의 원자적인 요구사항 하나",
        additionalProperties: false,
        required: ["id", "text", "kind", "requiredMonths"],
        properties: {
          id: {
            type: "string",
            description: "요구사항을 식별하는 고유 ID",
          },
          text: {
            type: "string",
            description: "공고에 나타난 하나의 원자적인 요구사항",
          },
          kind: {
            type: "string",
            enum: ["must", "nice"],
            description: "필수 요구사항은 must, 우대 요구사항은 nice",
          },
          requiredMonths: {
            type: ["integer", "null"],
            minimum: 1,
            description: "공고가 요구한 경력 개월 수이며 없으면 null",
          },
        },
      },
    },
  },
};

export const VERDICTS_SCHEMA: Record<string, unknown> = {
  type: "object",
  description: "요구사항별 이력서 매칭 판정 목록",
  additionalProperties: false,
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      description: "각 요구사항에 대한 매칭 판정 목록",
      items: {
        type: "object",
        description: "요구사항 하나에 대한 매칭 판정과 문장 제안",
        additionalProperties: false,
        required: [
          "requirementId",
          "bucket",
          "evidenceBlockIds",
          "confidence",
          "suggestion",
          "suggestionEvidenceBlockIds",
        ],
        properties: {
          requirementId: {
            type: "string",
            description: "판정 대상 요구사항의 ID",
          },
          bucket: {
            type: "string",
            enum: ["covered", "implicit", "missing"],
            description: "이력서에 명시됨, 암시됨, 근거 없음 중 하나의 판정",
          },
          evidenceBlockIds: {
            type: "array",
            description: "주어진 근거 목록에 실재하는 블록 ID만. 새로 만들어내지 말 것",
            items: {
              type: "string",
              description: "판정 근거인 Notion 블록 ID",
            },
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "0부터 1 사이의 판정 신뢰도",
          },
          suggestion: {
            type: ["string", "null"],
            description: "implicit 판정의 근거를 공고 용어로 고쳐 쓴 문장, 아니면 null",
          },
          suggestionEvidenceBlockIds: {
            type: ["array", "null"],
            description: "문장 제안에 사용한, 주어진 근거 목록에 실재하는 블록 ID만. 새로 만들어내지 말 것",
            items: {
              type: "string",
              description: "문장 제안에 사용한 Notion 블록 ID",
            },
          },
        },
      },
    },
  },
};

export interface ParseOutcome<T> {
  items: T[];
  errors: string[];
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseRaw(raw: unknown): ParseOutcome<unknown> {
  if (typeof raw !== "string") {
    return { items: [raw], errors: [] };
  }

  try {
    return { items: [JSON.parse(raw) as unknown], errors: [] };
  } catch {
    return { items: [], errors: ["응답 JSON 문자열을 파싱할 수 없습니다."] };
  }
}

function findCollection(
  raw: unknown,
  field: "requirements" | "verdicts",
): ParseOutcome<unknown> {
  const parsed = parseRaw(raw);
  if (parsed.errors.length > 0) {
    return parsed;
  }

  const value = parsed.items[0];
  if (Array.isArray(value)) {
    return { items: value, errors: [] };
  }

  if (!isRecord(value) || !Array.isArray(value[field])) {
    return {
      items: [],
      errors: [`응답에 ${field} 배열이 없습니다.`],
    };
  }

  return { items: value[field], errors: [] };
}

function isRequirementKind(value: unknown): value is RequirementKind {
  return value === "must" || value === "nice";
}

function isVerdictBucket(value: unknown): value is VerdictBucket {
  return value === "covered" || value === "implicit" || value === "missing";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function parseRequirements(raw: unknown): ParseOutcome<Requirement> {
  const collection = findCollection(raw, "requirements");
  if (collection.errors.length > 0) {
    return { items: [], errors: collection.errors };
  }

  const items: Requirement[] = [];
  const errors: string[] = [];
  const seenIds = new Set<string>();

  collection.items.forEach((candidate, index) => {
    if (!isRecord(candidate)) {
      errors.push(`requirements[${index}]: 객체가 아닙니다.`);
      return;
    }

    if (!isNonEmptyString(candidate.id)) {
      errors.push(`requirements[${index}]: id가 비어 있거나 문자열이 아닙니다.`);
      return;
    }

    if (!isNonEmptyString(candidate.text)) {
      errors.push(`requirements[${index}] (${candidate.id}): text가 비어 있거나 문자열이 아닙니다.`);
      return;
    }

    if (!isRequirementKind(candidate.kind)) {
      errors.push(`requirements[${index}] (${candidate.id}): kind가 must 또는 nice가 아닙니다.`);
      return;
    }

    if (seenIds.has(candidate.id)) {
      errors.push(`requirements[${index}] (${candidate.id}): 중복 id입니다.`);
      return;
    }

    const requirement: Requirement = {
      id: candidate.id,
      text: candidate.text,
      kind: candidate.kind,
    };

    if (
      typeof candidate.requiredMonths === "number" &&
      Number.isInteger(candidate.requiredMonths) &&
      candidate.requiredMonths > 0
    ) {
      requirement.requiredMonths = candidate.requiredMonths;
    }

    items.push(requirement);
    seenIds.add(candidate.id);
  });

  return { items, errors };
}

export function parseVerdicts(raw: unknown): ParseOutcome<Verdict> {
  const collection = findCollection(raw, "verdicts");
  if (collection.errors.length > 0) {
    return { items: [], errors: collection.errors };
  }

  const items: Verdict[] = [];
  const errors: string[] = [];
  const seenRequirementIds = new Set<string>();

  collection.items.forEach((candidate, index) => {
    if (!isRecord(candidate)) {
      errors.push(`verdicts[${index}]: 객체가 아닙니다.`);
      return;
    }

    if (!isNonEmptyString(candidate.requirementId)) {
      errors.push(`verdicts[${index}]: requirementId가 비어 있거나 문자열이 아닙니다.`);
      return;
    }

    if (!isVerdictBucket(candidate.bucket)) {
      errors.push(
        `verdicts[${index}] (${candidate.requirementId}): bucket이 covered, implicit, missing 중 하나가 아닙니다.`,
      );
      return;
    }

    if (
      typeof candidate.confidence !== "number" ||
      !Number.isFinite(candidate.confidence) ||
      candidate.confidence < 0 ||
      candidate.confidence > 1
    ) {
      errors.push(
        `verdicts[${index}] (${candidate.requirementId}): confidence가 0부터 1 사이의 유한한 수가 아닙니다.`,
      );
      return;
    }

    if (seenRequirementIds.has(candidate.requirementId)) {
      errors.push(
        `verdicts[${index}] (${candidate.requirementId}): 중복 requirementId입니다.`,
      );
      return;
    }

    const verdict: Verdict = {
      requirementId: candidate.requirementId,
      bucket: candidate.bucket,
      evidenceBlockIds: stringArray(candidate.evidenceBlockIds),
      confidence: candidate.confidence,
    };

    if (typeof candidate.suggestion === "string") {
      verdict.suggestion = candidate.suggestion;
    }

    if (candidate.suggestionEvidenceBlockIds !== undefined && candidate.suggestionEvidenceBlockIds !== null) {
      verdict.suggestionEvidenceBlockIds = stringArray(
        candidate.suggestionEvidenceBlockIds,
      );
    }

    items.push(verdict);
    seenRequirementIds.add(candidate.requirementId);
  });

  return { items, errors };
}
