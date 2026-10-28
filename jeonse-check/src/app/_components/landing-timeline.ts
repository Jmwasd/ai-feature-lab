// 랜딩 스크롤 장면의 진행도 계산. 진행도 F는 0(첫 장면)~4(마지막 장면)의 실수다.
// 3D 장면과 글 레이어가 같은 F로 움직이도록 여기에만 둔다.

export const CHAPTER_COUNT = 5;

// 각 장면이 차지하는 스크롤 높이(svh). 마지막 장면은 CTA를 읽고 머무를 시간을 준다.
export const CHAPTER_HEIGHTS = [170, 170, 170, 170, 200] as const;

// 섹션 앞머리에서 장면이 다 보인 채 머무는 스크롤 길이(svh). 섹션 높이에 더해진다.
// 두 번째 장면(01 숨은 위험)은 머무는 구간이 없으면 빠르게 스크롤할 때 보이지 않고 지나간다.
export const CHAPTER_HOLDS = [0, 220, 0, 0, 0] as const;

export const sectionHeight = (i: number) => CHAPTER_HOLDS[i] + CHAPTER_HEIGHTS[i];

export const clamp = (x: number, min = 0, max = 1) => Math.min(max, Math.max(min, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export type StoryFactors = {
  risk: number; // 01 숨은 위험
  scan: number; // 02 분석
  order: number; // 서류가 정렬되는 정도
  result: number; // 03 결과
  calm: number; // 위험 색이 가라앉는 정도
  fin: number; // 04 마지막 장면
  scanProgress: number; // 분석 진행 0~1
};

export function storyFactors(F: number): StoryFactors {
  return {
    risk: smoothstep(0.45, 1.0, F) * (1 - smoothstep(2.35, 2.9, F)),
    scan: smoothstep(1.45, 1.95, F) * (1 - smoothstep(2.55, 3.0, F)),
    order: smoothstep(1.4, 2.1, F),
    result: smoothstep(2.5, 3.05, F),
    calm: smoothstep(2.55, 3.3, F),
    fin: smoothstep(3.35, 3.95, F),
    scanProgress: smoothstep(1.5, 2.4, F),
  };
}

// 위험 신호 표식 i가 보이는 정도
export function riskAppear(i: number, F: number): number {
  return smoothstep(0.55 + i * 0.07, 0.85 + i * 0.07, F) * (1 - smoothstep(2.35, 2.85, F));
}

// 데이터 카드 j가 보이는 정도
export function dataAppear(j: number, F: number): number {
  return smoothstep(1.55 + j * 0.09, 1.8 + j * 0.09, F) * (1 - smoothstep(2.55, 2.95, F));
}

// 글 레이어 i의 불투명도. 첫 장면은 위로, 마지막 장면은 아래로 넘어가도 그대로 보인다.
export function chapterOpacity(i: number, F: number): number {
  const d = F - i;
  if ((i === 0 && d < 0) || (i === CHAPTER_COUNT - 1 && d > 0)) return 1;
  return clamp(1 - (Math.abs(d) - 0.22) * 2.6);
}

// 섹션 시작 위치(문서 기준 px)와 현재 스크롤로 진행도를 구한다.
export function progressFromScroll(tops: number[], scrollY: number): number {
  // 레이아웃 전(모든 top이 같음)에는 첫 장면으로 둔다.
  if (tops.length !== CHAPTER_COUNT || tops[CHAPTER_COUNT - 1] <= tops[0]) return 0;
  const last = CHAPTER_COUNT - 1;
  if (scrollY >= tops[last]) return last;
  const i = tops.findIndex((top, k) => k < last && scrollY < tops[k + 1]);
  if (i < 0) return 0;
  const hold = CHAPTER_HOLDS[i] / sectionHeight(i);
  return i + clamp(((scrollY - tops[i]) / (tops[i + 1] - tops[i]) - hold) / (1 - hold));
}

// 장면이 끝난 뒤 안내·푸터가 아래에서 올라온 길이(px). 고정 무대를 이만큼 올려 마지막 장면이 덮이지 않고 푸터 위에 남게 한다.
export function stageLift(storyEnd: number, scrollY: number, viewportHeight: number): number {
  return Math.max(0, scrollY + viewportHeight - storyEnd);
}
