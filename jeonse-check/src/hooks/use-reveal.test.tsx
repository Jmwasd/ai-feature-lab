import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { useReveal } from "./use-reveal";

type ObserverRecord = {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observe: Mock<(target: Element) => void>;
  disconnect: Mock<() => void>;
};

let observers: ObserverRecord[] = [];

function installObserver() {
  observers = [];
  class FakeObserver {
    record: ObserverRecord;
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.record = { callback, options, observe: vi.fn(), disconnect: vi.fn() };
      observers.push(this.record);
    }
    observe(target: Element) {
      this.record.observe(target);
    }
    unobserve() {}
    disconnect() {
      this.record.disconnect();
    }
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
}

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

function enter(isIntersecting = true) {
  const record = observers[0];
  act(() => {
    record.callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
}

function Probe({ delayMs }: { delayMs?: number }) {
  const { ref, visible } = useReveal<HTMLDivElement>({ delayMs });
  return (
    <div ref={ref} data-testid="probe">
      {visible ? "visible" : "hidden"}
    </div>
  );
}

beforeEach(() => {
  stubReducedMotion(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useReveal", () => {
  it("prefers-reduced-motion이면 처음부터 visible이고 관찰하지 않는다", () => {
    installObserver();
    stubReducedMotion(true);
    render(<Probe />);

    expect(screen.getByTestId("probe")).toHaveTextContent("visible");
    expect(observers).toHaveLength(0);
  });

  it("IntersectionObserver가 없으면 visible이다", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe />);

    expect(screen.getByTestId("probe")).toHaveTextContent("visible");
  });

  it("뷰포트 15% 진입 전에는 숨기고, 진입하면 visible로 바꾼 뒤 관찰을 멈춘다", () => {
    installObserver();
    render(<Probe />);
    const probe = screen.getByTestId("probe");

    expect(probe).toHaveTextContent("hidden");
    expect(observers).toHaveLength(1);
    expect(observers[0].options?.threshold).toBe(0.15);
    expect(observers[0].observe).toHaveBeenCalledWith(probe);

    enter(false);
    expect(probe).toHaveTextContent("hidden");

    enter(true);
    expect(probe).toHaveTextContent("visible");
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it("delayMs가 있으면 진입 후 그만큼 기다렸다가 visible로 바꾼다", () => {
    vi.useFakeTimers();
    installObserver();
    render(<Probe delayMs={200} />);

    enter(true);
    expect(screen.getByTestId("probe")).toHaveTextContent("hidden");

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId("probe")).toHaveTextContent("visible");
  });
});
