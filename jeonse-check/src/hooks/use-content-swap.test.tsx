import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTENT_SWAP_OUT_MS, useContentSwap } from "./use-content-swap";

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion: reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function Probe({ value }: { value: string }) {
  const { shown, hidden } = useContentSwap(value);
  return (
    <div data-testid="probe" data-hidden={hidden}>
      {shown}
    </div>
  );
}

describe("useContentSwap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("처음에는 값을 바로 보여 준다", () => {
    render(<Probe value="a" />);

    expect(screen.getByTestId("probe")).toHaveTextContent("a");
    expect(screen.getByTestId("probe")).toHaveAttribute("data-hidden", "false");
  });

  it("값이 바뀌면 340ms 동안 이전 내용을 숨긴 뒤 교체한다", () => {
    const { rerender } = render(<Probe value="a" />);
    rerender(<Probe value="b" />);

    expect(screen.getByTestId("probe")).toHaveTextContent("a");
    expect(screen.getByTestId("probe")).toHaveAttribute("data-hidden", "true");

    act(() => vi.advanceTimersByTime(CONTENT_SWAP_OUT_MS));
    expect(screen.getByTestId("probe")).toHaveTextContent("b");

    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByTestId("probe")).toHaveAttribute("data-hidden", "false");
  });

  it("사라지는 도중에 다시 바뀌면 마지막 값으로 교체한다", () => {
    const { rerender } = render(<Probe value="a" />);
    rerender(<Probe value="b" />);
    act(() => vi.advanceTimersByTime(CONTENT_SWAP_OUT_MS / 2));
    rerender(<Probe value="c" />);
    act(() => vi.advanceTimersByTime(CONTENT_SWAP_OUT_MS + 100));

    expect(screen.getByTestId("probe")).toHaveTextContent("c");
  });

  it("동작 줄이기면 바로 교체한다", () => {
    stubReducedMotion(true);
    const { rerender } = render(<Probe value="a" />);
    rerender(<Probe value="b" />);

    expect(screen.getByTestId("probe")).toHaveTextContent("b");
    expect(screen.getByTestId("probe")).toHaveAttribute("data-hidden", "false");
  });
});
