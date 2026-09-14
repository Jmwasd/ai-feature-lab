/** 두 LLM 호출이 같은 모델을 쓴다. 여기 한 곳에서만 바꾼다 */
export const OPENAI_MODEL = "gpt-5";

/**
 * 두 호출이 같은 추론 강도를 쓴다. 기본값(medium)에서는 매칭 한 번이 5분을 넘겨
 * 분석을 쓸 수 없었다. 판정 품질은 화면에서 보고 판단한다 (ADR-010)
 */
export const OPENAI_REASONING_EFFORT = "low";
