import { expect } from "vitest";

// 출처: docs/UI_GUIDE.md §6 "금지 표현" 목록. 원본 목록이 바뀌면 여기도 함께 고친다.
export const FORBIDDEN_PHRASES = ["안전", "안정", "양호", "문제없음", "괜찮", "위험 낮음"] as const;

export function expectNoForbiddenPhrases(text: string) {
  for (const phrase of FORBIDDEN_PHRASES) {
    expect(text, `"${phrase}" 포함: ${text}`).not.toContain(phrase);
  }
}
