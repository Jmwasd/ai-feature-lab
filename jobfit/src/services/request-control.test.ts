import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createDeadline, withAbort } from "./request-control";

afterEach(() => vi.useRealTimers());

describe("request controls", () => {
  it("ends a pending stream on its deadline and clears timers on disposal", async () => {
    vi.useFakeTimers();
    const deadline = createDeadline(100);
    const pending = withAbort(new Promise(() => {}), deadline.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    deadline.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("propagates parent cancellation and does not reject after disposal", async () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    const deadline = createDeadline(100, parent.signal);
    parent.abort(new Error("closed"));
    expect(deadline.signal.reason.message).toBe("closed");
    deadline.dispose();
    const finished = createDeadline(100);
    finished.dispose();
    await vi.runAllTimersAsync();
    expect(finished.signal.aborted).toBe(false);
  });

});
