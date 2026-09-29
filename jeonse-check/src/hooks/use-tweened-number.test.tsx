import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTweenedNumber } from "./use-tweened-number";

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce"), media: query }));
}

describe("useTweenedNumber", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("처음에는 목표값을 그대로 돌려준다", () => {
    const { result } = renderHook(() => useTweenedNumber(0.75));

    expect(result.current).toBe(0.75);
  });

  it("목표값이 바뀌면 중간값을 거쳐 목표값에 닿는다", async () => {
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ target }) => useTweenedNumber(target, 200), {
      initialProps: { target: 0.5 },
    });
    const seen: number[] = [];

    rerender({ target: 0.9 });
    await waitFor(() => {
      seen.push(result.current);
      expect(result.current).toBe(0.9);
    });
    expect(seen.some((v) => v > 0.5 && v < 0.9)).toBe(true);
  });

  it("동작 줄이기면 바로 목표값으로 바꾼다", () => {
    stubReducedMotion(true);
    const { result, rerender } = renderHook(({ target }) => useTweenedNumber(target), {
      initialProps: { target: 0.5 },
    });

    rerender({ target: 0.9 });

    expect(result.current).toBe(0.9);
  });
});
