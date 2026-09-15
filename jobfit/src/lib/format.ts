/** 공고가 요구하는 기간을 배지 문구로 만든다. 내 경력은 계산하지 않는다. */
export function formatRequiredMonths(months: number): string {
  if (!Number.isFinite(months) || months <= 0) {
    return "";
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years}년`);
  }

  if (remainingMonths > 0) {
    parts.push(`${remainingMonths}개월`);
  }

  return `요구 경력 ${parts.join(" ")}`;
}

/** 모델이 반환한 신뢰도를 소수 둘째 자리까지 표시한다. */
export function formatConfidence(confidence: number): string {
  return `신뢰도 ${confidence.toFixed(2)}`;
}
