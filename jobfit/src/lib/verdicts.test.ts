import { describe, expect, it } from "vitest";

import type { Requirement, ResumeEvidence, Verdict } from "@/types";

import { buildAnalysis, unjudgedRequirementIds } from "./verdicts";

const requirements: Requirement[] = [
  { id: "covered", text: "TypeScript 경험", kind: "must" },
  { id: "implicit", text: "CI/CD 경험", kind: "must" },
  { id: "missing", text: "Kubernetes 경험", kind: "nice" },
];

const evidence: ResumeEvidence[] = [
  {
    blockId: "block-1",
    text: "  TypeScript로 핵심 기능을 구현했습니다.\n원문 줄바꿈도 유지합니다.  ",
    company: "회사 A",
    project: "프로젝트 A",
  },
  {
    blockId: "block-2",
    text: "GitHub Actions로 배포를 자동화했습니다.",
    company: "회사 A",
    project: "프로젝트 B",
  },
  {
    blockId: "block-3",
    text: "Docker 기반 개발 환경을 구성했습니다.",
    company: "회사 B",
    project: "프로젝트 C",
  },
];

function verdict(
  requirementId: string,
  bucket: Verdict["bucket"],
  evidenceBlockIds: string[],
  overrides: Partial<Verdict> = {},
): Verdict {
  return {
    requirementId,
    bucket,
    evidenceBlockIds,
    confidence: 0.8,
    ...overrides,
  };
}

describe("buildAnalysis", () => {
  it("puts covered, implicit, and missing verdicts in their matching buckets", () => {
    const result = buildAnalysis(
      requirements,
      [
        verdict("covered", "covered", ["block-1"]),
        verdict("implicit", "implicit", ["block-2"], {
          suggestion: "CI/CD 배포 파이프라인을 구축했습니다.",
          suggestionEvidenceBlockIds: ["block-2"],
        }),
        verdict("missing", "missing", []),
      ],
      evidence,
    );

    expect(result.covered).toHaveLength(1);
    expect(result.implicit).toHaveLength(1);
    expect(result.missing).toHaveLength(1);
    expect(result.unjudged).toEqual([]);
    expect(result.covered[0].bucket).toBe("covered");
    expect(result.implicit[0].bucket).toBe("implicit");
    expect(result.missing[0].bucket).toBe("missing");
  });

  it("puts an unanswered requirement in unjudged instead of missing", () => {
    const result = buildAnalysis(requirements, [], evidence);

    expect(result.unjudged.map((item) => item.requirement.id)).toEqual([
      "covered",
      "implicit",
      "missing",
    ]);
    expect(result.missing).toEqual([]);
    expect(result.unjudged[0]).toMatchObject({
      bucket: "unjudged",
      evidence: [],
      confidence: null,
      suggestion: null,
      suggestionEvidence: [],
    });
  });

  it("drops unknown evidence ids and deduplicates repeated ids", () => {
    const result = buildAnalysis(
      [requirements[0]],
      [verdict("covered", "covered", ["block-1", "unknown", "block-1"])],
      evidence,
    );

    expect(result.covered[0].evidence).toEqual([evidence[0]]);
  });

  it("downgrades covered and implicit verdicts with no valid evidence to unjudged", () => {
    const result = buildAnalysis(
      requirements.slice(0, 2),
      [
        verdict("covered", "covered", ["unknown-1"]),
        verdict("implicit", "implicit", ["unknown-2"], {
          suggestion: "근거 없는 제안",
          suggestionEvidenceBlockIds: ["unknown-2"],
        }),
      ],
      evidence,
    );

    expect(result.covered).toEqual([]);
    expect(result.implicit).toEqual([]);
    expect(result.unjudged.map((item) => item.requirement.id)).toEqual([
      "covered",
      "implicit",
    ]);
    expect(result.unjudged.every((item) => item.confidence === null)).toBe(true);
  });

  it("discards evidence attached to a missing verdict", () => {
    const result = buildAnalysis(
      [requirements[2]],
      [verdict("missing", "missing", ["block-1"])],
      evidence,
    );

    expect(result.missing[0].evidence).toEqual([]);
  });

  it("keeps the original ResumeEvidence object and filters unknown suggestion evidence", () => {
    const result = buildAnalysis(
      [requirements[1]],
      [
        verdict("implicit", "implicit", ["block-1"], {
          suggestion: "CI/CD 경험으로 표현합니다.",
          suggestionEvidenceBlockIds: ["unknown", "block-1"],
        }),
      ],
      evidence,
    );

    expect(result.implicit[0].evidence[0]).toBe(evidence[0]);
    expect(result.implicit[0].evidence[0].text).toBe(evidence[0].text);
    expect(result.implicit[0].suggestionEvidence).toEqual([evidence[0]]);
  });

  it("turns a blank implicit suggestion into null without changing its bucket", () => {
    const result = buildAnalysis(
      [requirements[1]],
      [
        verdict("implicit", "implicit", ["block-2"], {
          suggestion: "   ",
          suggestionEvidenceBlockIds: ["block-2"],
        }),
      ],
      evidence,
    );

    expect(result.implicit[0]).toMatchObject({
      bucket: "implicit",
      suggestion: null,
      suggestionEvidence: [],
    });
  });

  it("ignores verdicts for unknown requirements and preserves requirement order", () => {
    const orderedRequirements = [
      requirements[2],
      requirements[0],
      requirements[1],
    ];
    const result = buildAnalysis(
      orderedRequirements,
      [
        verdict("unknown-requirement", "missing", []),
        verdict("implicit", "implicit", ["block-2"]),
        verdict("covered", "covered", ["block-1"]),
        verdict("missing", "missing", []),
      ],
      evidence,
    );

    expect(result.missing.map((item) => item.requirement.id)).toEqual(["missing"]);
    expect(result.covered.map((item) => item.requirement.id)).toEqual(["covered"]);
    expect(result.implicit.map((item) => item.requirement.id)).toEqual(["implicit"]);
    expect(
      [...result.missing, ...result.covered, ...result.implicit].some(
        (item) => item.requirement.id === "unknown-requirement",
      ),
    ).toBe(false);

    const sameBucket = buildAnalysis(
      orderedRequirements,
      orderedRequirements.map((requirement) =>
        verdict(requirement.id, "missing", []),
      ),
      evidence,
    );
    expect(sameBucket.missing.map((item) => item.requirement.id)).toEqual([
      "missing",
      "covered",
      "implicit",
    ]);
  });

  it("marks every requirement unjudged when verdicts are empty", () => {
    const result = buildAnalysis(requirements, [], evidence);

    expect(result.unjudged.map((item) => item.requirement.id)).toEqual([
      "covered",
      "implicit",
      "missing",
    ]);
    expect(unjudgedRequirementIds(requirements, [])).toEqual([
      "covered",
      "implicit",
      "missing",
    ]);
  });

  it("rejects suggestion evidence that exists globally but not in the verdict evidence", () => {
    const result = buildAnalysis(
      [requirements[1]],
      [
        verdict("implicit", "implicit", ["block-1"], {
          suggestion: "CI/CD 경험으로 표현합니다.",
          suggestionEvidenceBlockIds: ["block-2"],
        }),
      ],
      evidence,
    );

    expect(result.implicit[0]).toMatchObject({
      bucket: "implicit",
      evidence: [evidence[0]],
      suggestion: null,
      suggestionEvidence: [],
    });
  });

  it("keeps valid suggestion evidence and the suggestion when only some ids match", () => {
    const result = buildAnalysis(
      [requirements[1]],
      [
        verdict("implicit", "implicit", ["block-1", "block-2"], {
          suggestion: "CI/CD 배포 파이프라인을 구축했습니다.",
          suggestionEvidenceBlockIds: ["unknown", "block-2"],
        }),
      ],
      evidence,
    );

    expect(result.implicit[0].suggestion).toBe(
      "CI/CD 배포 파이프라인을 구축했습니다.",
    );
    expect(result.implicit[0].suggestionEvidence).toEqual([evidence[1]]);
  });
});

describe("unjudgedRequirementIds", () => {
  it("returns only requirement ids that have no verdict and preserves input order", () => {
    expect(
      unjudgedRequirementIds(requirements, [
        verdict("unknown-requirement", "missing", []),
        verdict("implicit", "implicit", ["block-2"]),
      ]),
    ).toEqual(["covered", "missing"]);
  });
});
