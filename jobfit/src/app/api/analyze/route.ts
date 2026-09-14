import { MAX_POSTING_CHARS } from "@/lib/posting-text";
import { buildAnalysis } from "@/lib/verdicts";
import { getResumeEvidence } from "@/services/notion";
import { extractRequirements, matchVerdicts } from "@/services/openai";
import {
  fetchPosting,
  postingFromPastedText,
  type PostingFetchFailure,
} from "@/services/posting";
import type { Requirement, ResumeEvidence, Verdict } from "@/types";
import type { AnalyzeRequest, AnalyzeResponse } from "@/types/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_URL_LENGTH = 2_048;
const MAX_PASTED_TEXT_LENGTH = MAX_POSTING_CHARS * 2;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function jsonResponse(body: AnalyzeResponse, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ status: "error", message }, status);
}

function hasOwn(value: Record<string, unknown>, key: keyof AnalyzeRequest): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function failureStatus(
  inputKind: "url" | "text",
  reason: PostingFetchFailure,
): "needs-paste" | "error" {
  if (inputKind === "url" && reason !== "blocked-url") {
    return "needs-paste";
  }

  return "error";
}

function notionErrorMessage(error: unknown): string {
  const cause = error instanceof Error ? error.message : "알 수 없는 Notion 오류";

  return (
    "Notion 이력서를 읽지 못했습니다. NOTION_TOKEN과 NOTION_RESUME_PAGE_ID 환경 변수, " +
    `이력서 페이지의 Notion integration 권한을 확인하세요. 원인: ${cause}`
  );
}

function logParsingErrors(stage: string, errors: string[]): void {
  if (errors.length > 0) {
    console.error(`[analyze] ${stage} 응답 파싱 오류`, errors);
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    console.error("[analyze] 요청 JSON 파싱 실패", error instanceof Error ? error.message : error);
    return errorResponse("요청 본문은 올바른 JSON이어야 합니다");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    console.error("[analyze] 요청 본문 형식 오류: JSON 객체가 아님");
    return errorResponse("요청 본문은 JSON 객체여야 합니다");
  }

  const input = body as Record<string, unknown>;
  const hasUrl = hasOwn(input, "url");
  const hasText = hasOwn(input, "text");

  if (hasUrl === hasText) {
    console.error("[analyze] 입력 검증 실패: url과 text 중 정확히 하나가 필요함");
    return errorResponse("url과 text 중 정확히 하나만 보내야 합니다");
  }

  if (hasUrl && (typeof input.url !== "string" || input.url.length > MAX_URL_LENGTH)) {
    console.error("[analyze] URL 입력 검증 실패: 문자열이 아니거나 2048자 초과");
    return errorResponse("url은 2048자 이하의 문자열이어야 합니다");
  }

  if (
    hasText &&
    (typeof input.text !== "string" || input.text.length > MAX_PASTED_TEXT_LENGTH)
  ) {
    console.error(
      `[analyze] 본문 입력 검증 실패: 문자열이 아니거나 ${MAX_PASTED_TEXT_LENGTH}자 초과`,
    );
    return errorResponse(`text는 ${MAX_PASTED_TEXT_LENGTH}자 이하의 문자열이어야 합니다`);
  }

  const inputKind = hasUrl ? "url" : "text";
  const postingResult =
    inputKind === "url"
      ? await fetchPosting(input.url as string)
      : postingFromPastedText(input.text as string);

  if (!postingResult.ok) {
    const status = failureStatus(inputKind, postingResult.reason);
    console.error(
      `[analyze] 공고 본문 확보 실패 (${inputKind}/${postingResult.reason}): ${postingResult.message}`,
    );

    if (status === "needs-paste") {
      return jsonResponse({ status, message: postingResult.message });
    }

    return errorResponse(postingResult.message);
  }

  let evidence: ResumeEvidence[];

  try {
    evidence = await getResumeEvidence();

    if (evidence.length === 0) {
      const message =
        "Notion 이력서에서 근거를 찾지 못했습니다. NOTION_RESUME_PAGE_ID와 이력서 페이지 구조, " +
        "Notion integration 권한을 확인하세요.";
      console.error(`[analyze] ${message}`);
      return errorResponse(message, 500);
    }
  } catch (error) {
    const message = notionErrorMessage(error);
    console.error(`[analyze] ${message}`);
    return errorResponse(message, 500);
  }

  let requirements: Requirement[];

  try {
    const extraction = await extractRequirements(postingResult.posting.rawText);
    requirements = extraction.requirements;
    logParsingErrors("요구사항 추출", extraction.errors);
  } catch {
    const message =
      "OpenAI 요구사항 추출에 실패했습니다. 네트워크 연결, API 키, 사용량 제한을 확인하세요.";
    console.error("[analyze] OpenAI 요구사항 추출 호출 실패");
    return errorResponse(message, 500);
  }

  if (requirements.length === 0) {
    const message =
      "공고에서 요구사항을 찾지 못했습니다. 자격요건과 우대사항이 포함된 공고 본문인지 확인해 주세요.";
    console.error(`[analyze] ${message}`);
    return errorResponse(message, 500);
  }

  let verdicts: Verdict[];

  try {
    const matching = await matchVerdicts(requirements, evidence);
    verdicts = matching.verdicts;
    logParsingErrors("매칭 판정", matching.errors);
  } catch {
    const message =
      "OpenAI 매칭 판정에 실패했습니다. 네트워크 연결, API 키, 사용량 제한을 확인하세요.";
    console.error("[analyze] OpenAI 매칭 판정 호출 실패");
    return errorResponse(message, 500);
  }

  const result = buildAnalysis(requirements, verdicts, evidence);

  if (result.unjudged.length > 0) {
    console.warn(`[analyze] 판정 없음 ${result.unjudged.length}개`);
  }

  return jsonResponse({
    status: "ok",
    posting: {
      title: postingResult.title,
      ...(postingResult.posting.sourceUrl
        ? { sourceUrl: postingResult.posting.sourceUrl }
        : {}),
    },
    requirementCount: requirements.length,
    result,
  });
}
