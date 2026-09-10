/**
 * Notion 원문에 연결된 이력서 근거다. blockId는 안정적인 Notion 블록 ID이며,
 * 화면에 표시할 근거를 원문에 앵커링한다 (ADR-003, ADR-004).
 */
export interface ResumeEvidence {
  blockId: string;
  text: string;
  company: string;
  project: string;
}

/**
 * 분석할 채용공고 원문이다. 붙여넣은 공고에는 sourceUrl이 없다.
 */
export interface JobPosting {
  sourceUrl?: string;
  rawText: string;
}

/**
 * 공고가 요구사항을 필수 또는 우대로 구분한 결과다.
 */
export type RequirementKind = "must" | "nice";

/**
 * 공고에서 추출한 원자적 요구사항이다. requiredMonths는 공고가 요구한 기간일 뿐,
 * 내 경력을 계산하는 데 쓰지 않는다 (ADR-009).
 */
export interface Requirement {
  id: string;
  text: string;
  kind: RequirementKind;
  requiredMonths?: number;
}

/**
 * 이력서 근거와 요구사항의 관계를 세 칸으로 분류한다.
 */
export type VerdictBucket = "covered" | "implicit" | "missing";

/**
 * 판정과 문장 제안을 같은 객체에 둔다. 호출을 나누면 화면의 근거와 제안 출처가
 * 어긋날 수 있으므로, 하나의 LLM 호출에서 함께 반환받는다 (ADR-007).
 */
export interface Verdict {
  requirementId: string;
  bucket: VerdictBucket;
  evidenceBlockIds: string[];
  confidence: number;
  suggestion?: string;
  suggestionEvidenceBlockIds?: string[];
}
