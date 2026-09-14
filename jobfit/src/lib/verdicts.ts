import type {
  AnalysisItem,
  AnalysisResult,
  Requirement,
  ResumeEvidence,
  Verdict,
} from "@/types";

function unjudgedItem(requirement: Requirement): AnalysisItem {
  return {
    requirement,
    bucket: "unjudged",
    evidence: [],
    confidence: null,
    suggestion: null,
    suggestionEvidence: [],
  };
}

function evidenceByBlockId(
  evidence: ResumeEvidence[],
): Map<string, ResumeEvidence> {
  const byBlockId = new Map<string, ResumeEvidence>();

  for (const item of evidence) {
    if (!byBlockId.has(item.blockId)) {
      byBlockId.set(item.blockId, item);
    }
  }

  return byBlockId;
}

function validEvidence(
  blockIds: string[],
  byBlockId: Map<string, ResumeEvidence>,
): ResumeEvidence[] {
  const seen = new Set<string>();
  const valid: ResumeEvidence[] = [];

  for (const blockId of blockIds) {
    if (seen.has(blockId)) {
      continue;
    }

    seen.add(blockId);
    const item = byBlockId.get(blockId);
    if (item) {
      valid.push(item);
    }
  }

  return valid;
}

function itemFromVerdict(
  requirement: Requirement,
  verdict: Verdict,
  byBlockId: Map<string, ResumeEvidence>,
): AnalysisItem {
  if (verdict.bucket === "missing") {
    return {
      requirement,
      bucket: "missing",
      evidence: [],
      confidence: verdict.confidence,
      suggestion: null,
      suggestionEvidence: [],
    };
  }

  const evidence = validEvidence(verdict.evidenceBlockIds, byBlockId);
  if (evidence.length === 0) {
    return unjudgedItem(requirement);
  }

  if (verdict.bucket === "covered") {
    return {
      requirement,
      bucket: "covered",
      evidence,
      confidence: verdict.confidence,
      suggestion: null,
      suggestionEvidence: [],
    };
  }

  const suggestion =
    typeof verdict.suggestion === "string" && verdict.suggestion.trim().length > 0
      ? verdict.suggestion
      : null;

  if (suggestion === null) {
    return {
      requirement,
      bucket: "implicit",
      evidence,
      confidence: verdict.confidence,
      suggestion: null,
      suggestionEvidence: [],
    };
  }

  const verdictEvidenceByBlockId = evidenceByBlockId(evidence);
  const suggestionEvidence = validEvidence(
    verdict.suggestionEvidenceBlockIds ?? [],
    verdictEvidenceByBlockId,
  );

  return {
    requirement,
    bucket: "implicit",
    evidence,
    confidence: verdict.confidence,
    suggestion: suggestionEvidence.length > 0 ? suggestion : null,
    suggestionEvidence:
      suggestionEvidence.length > 0 ? suggestionEvidence : [],
  };
}

export function buildAnalysis(
  requirements: Requirement[],
  verdicts: Verdict[],
  evidence: ResumeEvidence[],
): AnalysisResult {
  const result: AnalysisResult = {
    covered: [],
    implicit: [],
    missing: [],
    unjudged: [],
  };
  const requirementIds = new Set(
    requirements.map((requirement) => requirement.id),
  );
  const verdictByRequirementId = new Map<string, Verdict>();

  for (const verdict of verdicts) {
    if (
      requirementIds.has(verdict.requirementId) &&
      !verdictByRequirementId.has(verdict.requirementId)
    ) {
      verdictByRequirementId.set(verdict.requirementId, verdict);
    }
  }

  const byBlockId = evidenceByBlockId(evidence);

  for (const requirement of requirements) {
    const verdict = verdictByRequirementId.get(requirement.id);
    const item = verdict
      ? itemFromVerdict(requirement, verdict, byBlockId)
      : unjudgedItem(requirement);

    result[item.bucket].push(item);
  }

  return result;
}

/** 재시도용. 아직 판정이 오지 않은 requirement id들이다. */
export function unjudgedRequirementIds(
  requirements: Requirement[],
  verdicts: Verdict[],
): string[] {
  const judgedIds = new Set(verdicts.map((verdict) => verdict.requirementId));

  return requirements
    .filter((requirement) => !judgedIds.has(requirement.id))
    .map((requirement) => requirement.id);
}
