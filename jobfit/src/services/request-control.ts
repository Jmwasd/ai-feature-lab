import "server-only";

export const ANALYSIS_TIMEOUT_MS = 120_000;
export const OPENAI_CALL_TIMEOUT_MS = 60_000;
export const NOTION_TIMEOUT_MS = 30_000;

/** SDK의 헤더 타임아웃과 별개로, 본문/스트림 완료까지 같은 취소 신호를 유지한다. */
export function createDeadline(ms: number, parent?: AbortSignal, message = "분석 시간이 초과되었습니다") {
  const controller = new AbortController();
  const abort = () => controller.abort(parent?.reason);
  const timer = setTimeout(() => controller.abort(new DOMException(message, "TimeoutError")), ms);
  if (parent?.aborted) abort();
  else parent?.addEventListener("abort", abort, { once: true });

  return {
    signal: controller.signal,
    abort: (reason?: unknown) => controller.abort(reason),
    dispose() {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abort);
    },
  };
}

/** 대기를 끝내는 동시에 호출자도 반드시 signal을 실제 I/O에 전달해야 한다. */
export function withAbort<T>(task: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return task;
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    const cleanup = () => signal.removeEventListener("abort", abort);
    // 이미 취소된 경우에도 task의 rejection을 소비한다.
    task.then(
      (value) => { cleanup(); resolve(value); },
      (error) => { cleanup(); reject(error); },
    );
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}
