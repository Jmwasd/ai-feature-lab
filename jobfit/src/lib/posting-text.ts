export const MIN_POSTING_LENGTH = 400;
export const MAX_POSTING_CHARS = 20_000;

const TRUNCATION_NOTICE = "\n\n[본문이 길어 일부가 잘렸습니다.]";

/** 연속 공백·개행을 정리한다. 길이 판정 전에 반드시 거친다. */
export function normalizePostingText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 본문 추출이 성공했다고 볼 만큼 긴가. */
export function isExtractionSufficient(text: string): boolean {
  return normalizePostingText(text).length >= MIN_POSTING_LENGTH;
}

/** 모델 컨텍스트 한도를 넘지 않게 자른다. */
export function truncatePostingText(text: string): string {
  if (text.length <= MAX_POSTING_CHARS) {
    return text;
  }

  return `${text.slice(0, MAX_POSTING_CHARS - TRUNCATION_NOTICE.length)}${TRUNCATION_NOTICE}`;
}
