import "server-only";

// 공공데이터 어댑터가 함께 쓰는 HTTP 기반. 타임아웃·재시도·오류 분류·키 가림을 여기서 맡는다.
// 기본값은 정책 수치가 아니라 통신 설정이므로 이 파일 상수로 둔다.
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
// 재시도 간격. n번째 재시도는 n배를 기다린다.
const DEFAULT_RETRY_DELAY_MS = 500;

// 쿼리에 실리는 인증키 이름(소문자). data.go.kr serviceKey, vworld key, juso confmKey.
const SECRET_PARAMS = new Set(["servicekey", "key", "confmkey"]);
const REDACTED = "***";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface HttpOptions {
  fetch?: FetchLike;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export type PublicDataSource = "molit-trade" | "building" | "vworld" | "juso";
export type PublicDataErrorKind = "timeout" | "http" | "api" | "parse" | "quota";

export interface RequestOptions extends HttpOptions {
  source: PublicDataSource;
}

// 메시지와 필드에는 redactUrl을 거친 URL만 담는다. 원인 예외(cause)는 키가 섞여 있을 수 있어 싣지 않는다.
export class PublicDataError extends Error {
  readonly kind: PublicDataErrorKind;
  readonly source: PublicDataSource;
  readonly url?: string;
  readonly status?: number;

  constructor(
    kind: PublicDataErrorKind,
    source: PublicDataSource,
    detail: string,
    extra: { url?: URL; status?: number } = {},
  ) {
    const url = extra.url ? redactUrl(extra.url) : undefined;
    super(`[${source}] ${kind}: ${detail}${url ? ` (${url})` : ""}`);
    this.name = "PublicDataError";
    this.kind = kind;
    this.source = source;
    this.url = url;
    this.status = extra.status;
  }
}

// 인증키 쿼리 값을 가린 URL 문자열. 원본 URL은 바꾸지 않는다.
export function redactUrl(url: URL): string {
  const copy = new URL(url);
  for (const name of new Set(copy.searchParams.keys())) {
    if (SECRET_PARAMS.has(name.toLowerCase())) {
      copy.searchParams.set(name, REDACTED);
    }
  }
  // searchParams.set이 "*"를 그대로 두므로 serviceKey=*** 형태로 남는다.
  return copy.toString();
}

export async function getText(url: URL, options: RequestOptions): Promise<string> {
  return request(url, options);
}

export async function getJson<T = unknown>(url: URL, options: RequestOptions): Promise<T> {
  const text = await getText(url, options);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new PublicDataError("parse", options.source, "JSON 파싱 실패", { url });
  }
}

// 재시도할 수 있는 실패. 네트워크 오류·타임아웃·5xx만 해당한다.
class RetryableFailure extends Error {
  constructor(readonly error: PublicDataError) {
    super(error.message);
  }
}

async function request(url: URL, options: RequestOptions): Promise<string> {
  const {
    source,
    fetch: fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  } = options;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await attemptOnce(url, source, fetchImpl, timeoutMs);
    } catch (failure) {
      if (!(failure instanceof RetryableFailure)) throw failure;
      if (attempt >= retries) throw failure.error;
      await sleep(retryDelayMs * (attempt + 1));
    }
  }
}

async function attemptOnce(
  url: URL,
  source: PublicDataSource,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // 본문을 다 읽을 때까지 타임아웃을 건다. 헤더만 오고 본문이 멈추는 경우도 잡는다.
  let response: Response;
  let body: string;
  try {
    response = await fetchImpl(url.toString(), { signal: controller.signal });
    body = await response.text();
  } catch (error) {
    if (controller.signal.aborted) {
      throw new RetryableFailure(
        new PublicDataError("timeout", source, `${timeoutMs}ms 안에 응답이 없다`, { url }),
      );
    }
    // 원인 메시지에 요청 URL(키 포함)이 섞일 수 있어 예외 이름만 남긴다.
    const name = error instanceof Error ? error.name : "UnknownError";
    throw new RetryableFailure(
      new PublicDataError("http", source, `네트워크 오류(${name})`, { url }),
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.ok) return body;

  const { status } = response;
  if (status === 429) {
    throw new PublicDataError("quota", source, "호출 한도 초과(HTTP 429)", { url, status });
  }
  const error = new PublicDataError("http", source, `HTTP ${status}`, { url, status });
  if (status >= 500) throw new RetryableFailure(error);
  throw error;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
