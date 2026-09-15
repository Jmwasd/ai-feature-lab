import { describe, expect, it } from "vitest";

import {
  REQUIREMENTS_SCHEMA,
  VERDICTS_SCHEMA,
  parseRequirements,
  parseVerdicts,
} from "./schemas";

describe("structured output schemas", () => {
  it("wraps requirements in a strict top-level object", () => {
    expect(REQUIREMENTS_SCHEMA).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["requirements"],
      properties: {
        requirements: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "text", "kind", "requiredMonths"],
          },
        },
      },
    });
  });

  it("wraps verdicts in a strict top-level object", () => {
    expect(VERDICTS_SCHEMA).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["verdicts"],
      properties: {
        verdicts: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "requirementId",
              "bucket",
              "evidenceBlockIds",
              "confidence",
              "suggestion",
              "suggestionEvidenceBlockIds",
            ],
          },
        },
      },
    });
  });
});

describe("parseRequirements", () => {
  const validRequirement = {
    id: "req-1",
    text: "TypeScript 실무 경험",
    kind: "must",
    requiredMonths: 24,
  };

  it.each([
    { label: "wrapped object", raw: { requirements: [validRequirement] } },
    { label: "bare array", raw: [validRequirement] },
  ])("accepts a valid requirements $label", ({ raw }) => {
    expect(parseRequirements(raw)).toEqual({
      items: [validRequirement],
      errors: [],
    });
  });

  it("parses a JSON string and reports malformed JSON", () => {
    expect(
      parseRequirements(JSON.stringify({ requirements: [validRequirement] })),
    ).toEqual({ items: [validRequirement], errors: [] });

    const malformed = parseRequirements('{"requirements":[');

    expect(malformed.items).toEqual([]);
    expect(malformed.errors).toHaveLength(1);
    expect(malformed.errors[0]).toMatch(/JSON/i);
  });

  it("drops only requirements with an invalid or missing kind", () => {
    const result = parseRequirements({
      requirements: [
        validRequirement,
        { ...validRequirement, id: "req-2", kind: "required" },
        { id: "req-3", text: "React 경험", requiredMonths: null },
      ],
    });

    expect(result.items).toEqual([validRequirement]);
    expect(result.errors).toHaveLength(2);
    expect(result.items).not.toContainEqual(expect.objectContaining({ kind: "must", id: "req-3" }));
  });

  it("normalizes null months and removes only invalid month fields", () => {
    const result = parseRequirements({
      requirements: [
        { ...validRequirement, id: "null", requiredMonths: null },
        { ...validRequirement, id: "negative", requiredMonths: -3 },
        { ...validRequirement, id: "decimal", requiredMonths: 2.5 },
      ],
    });

    expect(result).toEqual({
      items: [
        { id: "null", text: validRequirement.text, kind: "must" },
        { id: "negative", text: validRequirement.text, kind: "must" },
        { id: "decimal", text: validRequirement.text, kind: "must" },
      ],
      errors: [],
    });
  });

  it("keeps the first requirement with a duplicate id", () => {
    const result = parseRequirements({
      requirements: [
        validRequirement,
        { ...validRequirement, text: "뒤에 온 항목" },
      ],
    });

    expect(result.items).toEqual([validRequirement]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/req-1/);
  });

  it("returns one error when the requirements collection is unavailable", () => {
    expect(parseRequirements({ verdicts: [] })).toMatchObject({
      items: [],
      errors: [expect.any(String)],
    });
  });
});

describe("parseVerdicts", () => {
  const validVerdict = {
    requirementId: "req-1",
    bucket: "implicit",
    evidenceBlockIds: ["block-1"],
    confidence: 0.8,
    suggestion: "CI/CD 파이프라인을 구축하고 운영했습니다.",
    suggestionEvidenceBlockIds: ["block-1"],
  };

  it("accepts confidence boundaries and drops out-of-range or non-finite verdicts", () => {
    const result = parseVerdicts({
      verdicts: [
        { ...validVerdict, requirementId: "zero", confidence: 0 },
        { ...validVerdict, requirementId: "one", confidence: 1 },
        { ...validVerdict, requirementId: "high", confidence: 1.5 },
        { ...validVerdict, requirementId: "nan", confidence: Number.NaN },
      ],
    });

    expect(result.items.map(({ requirementId }) => requirementId)).toEqual(["zero", "one"]);
    expect(result.errors).toHaveLength(2);
  });

  it("drops a verdict whose bucket is not covered, implicit, or missing", () => {
    const result = parseVerdicts({
      verdicts: [validVerdict, { ...validVerdict, requirementId: "bad", bucket: "unknown" }],
    });

    expect(result.items).toEqual([validVerdict]);
    expect(result.errors).toHaveLength(1);
  });

  it("filters non-string evidence ids and keeps the first duplicate requirement verdict", () => {
    const result = parseVerdicts({
      verdicts: [
        {
          ...validVerdict,
          evidenceBlockIds: ["block-1", 42, "block-2"],
          suggestionEvidenceBlockIds: [false, "block-2"],
        },
        { ...validVerdict, bucket: "covered" },
      ],
    });

    expect(result.items).toEqual([
      {
        ...validVerdict,
        evidenceBlockIds: ["block-1", "block-2"],
        suggestionEvidenceBlockIds: ["block-2"],
      },
    ]);
    expect(result.errors).toHaveLength(1);
  });

  it("normalizes nullable optional fields and non-array evidence collections", () => {
    const result = parseVerdicts({
      verdicts: [
        {
          ...validVerdict,
          evidenceBlockIds: null,
          suggestion: null,
          suggestionEvidenceBlockIds: "block-1",
        },
      ],
    });

    expect(result).toEqual({
      items: [
        {
          requirementId: "req-1",
          bucket: "implicit",
          evidenceBlockIds: [],
          confidence: 0.8,
          suggestionEvidenceBlockIds: [],
        },
      ],
      errors: [],
    });
  });

  it("adds exactly one single-line error for every discarded verdict", () => {
    const result = parseVerdicts([
      validVerdict,
      { ...validVerdict, requirementId: "" },
      { ...validVerdict, requirementId: "bad-bucket", bucket: "other" },
      { ...validVerdict, requirementId: "bad-confidence", confidence: -0.1 },
    ]);

    expect(result.items).toEqual([validVerdict]);
    expect(result.errors).toHaveLength(3);
    expect(result.errors.every((error) => !error.includes("\n"))).toBe(true);
  });
});
