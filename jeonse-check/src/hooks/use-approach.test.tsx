import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APPROACH_RATE, useApproach } from "./use-approach";

function stubFrames() {
  const queue: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => queue.push(cb));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  return {
    flush(count: number) {
      for (let i = 0; i < count && queue.length > 0; i++) act(() => queue.shift()!(0));
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useApproach", () => {
  it("active가 아니면 0에 머문다", () => {
    stubFrames();
    const { result } = renderHook(() => useApproach(80, false));

    expect(result.current).toBe(0);
  });

  it("active면 프레임마다 남은 거리의 일정 비율만큼 다가가고 목표에 닿으면 멈춘다", () => {
    const frames = stubFrames();
    const { result } = renderHook(() => useApproach(80, true));

    frames.flush(1);
    expect(result.current).toBeCloseTo(80 * APPROACH_RATE);
    frames.flush(500);
    expect(result.current).toBe(80);
  });

  it("목표가 바뀌면 지금 값에서 새 목표로 다가간다", () => {
    const frames = stubFrames();
    const { result, rerender } = renderHook(({ target }) => useApproach(target, true), { initialProps: { target: 80 } });
    frames.flush(500);

    rerender({ target: 40 });
    frames.flush(1);
    expect(result.current).toBeCloseTo(80 - 40 * APPROACH_RATE);
  });

  it("동작 줄이기면 바로 목표값을 쓴다", () => {
    stubFrames();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    const { result } = renderHook(() => useApproach(80, true));

    expect(result.current).toBe(80);
  });
});
