import { describe, expect, it } from "vitest";
import { CHAPTER_HEIGHTS, CHAPTER_HOLDS, chapterOpacity, progressFromScroll, sectionHeight, stageLift } from "./landing-timeline";

// 1svh = 10px로 두고 섹션 시작 위치를 만든다.
const tops = CHAPTER_HEIGHTS.reduce<number[]>((acc, _, i) => [...acc, i === 0 ? 0 : acc[i - 1] + sectionHeight(i - 1) * 10], []);

describe("progressFromScroll", () => {
  it("머무는 구간 동안 두 번째 장면을 다 보인 채로 둔다", () => {
    const holdEnd = tops[1] + CHAPTER_HOLDS[1] * 10;
    expect(progressFromScroll(tops, tops[1])).toBe(1);
    expect(progressFromScroll(tops, holdEnd - 1)).toBe(1);
    expect(chapterOpacity(1, progressFromScroll(tops, holdEnd - 1))).toBe(1);
  });

  it("머무는 구간이 끝나면 다음 장면으로 넘어간다", () => {
    const holdEnd = tops[1] + CHAPTER_HOLDS[1] * 10;
    expect(progressFromScroll(tops, (holdEnd + tops[2]) / 2)).toBeCloseTo(1.5);
    expect(progressFromScroll(tops, tops[2])).toBe(2);
  });

  it("머무는 구간이 없는 장면은 섹션 안에서 고르게 넘어간다", () => {
    expect(progressFromScroll(tops, (tops[0] + tops[1]) / 2)).toBeCloseTo(0.5);
  });
});

describe("stageLift", () => {
  it("장면이 끝나기 전에는 무대를 올리지 않는다", () => {
    expect(stageLift(5000, 4000, 900)).toBe(0);
    expect(stageLift(5000, 4100, 900)).toBe(0);
  });

  it("뒤 콘텐츠가 올라온 만큼 무대를 같이 올린다", () => {
    expect(stageLift(5000, 4300, 900)).toBe(200);
  });
});
