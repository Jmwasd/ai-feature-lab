import 'server-only';

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

import {
  isExtractionSufficient,
  normalizePostingText,
  truncatePostingText,
} from "@/lib/posting-text";
import { checkPostingUrl } from "@/lib/url-guard";
import type { JobPosting } from "@/types";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const PASTE_FALLBACK_MESSAGE =
  "이 사이트는 본문을 읽지 못했습니다. 공고 내용을 복사해 붙여넣어 주세요";
const PASTED_TOO_SHORT_MESSAGE =
  "붙여넣은 공고가 너무 짧습니다. 자격요건·우대사항이 포함된 본문 전체를 붙여넣어 주세요";

export type PostingFetchFailure = "blocked-url" | "fetch-failed" | "not-html" | "too-short";

export type PostingFetchResult =
  | { ok: true; posting: JobPosting; title: string }
  | { ok: false; reason: PostingFetchFailure; message: string };

export interface FetchPostingDeps {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

function failure(reason: PostingFetchFailure): PostingFetchResult {
  if (reason === "blocked-url") {
    return {
      ok: false,
      reason,
      message: "열 수 없는 공고 URL입니다. http:// 또는 https://로 시작하는 공개 주소인지 확인해 주세요",
    };
  }

  if (reason === "not-html") {
    return {
      ok: false,
      reason,
      message: "HTML 형식의 공고가 아닙니다. 공고 내용을 복사해 붙여넣어 주세요",
    };
  }

  return { ok: false, reason, message: PASTE_FALLBACK_MESSAGE };
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

function isHtmlContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }

  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "text/html" || mediaType === "application/xhtml+xml";
}

function responseIsTooLarge(contentLength: string | null): boolean {
  if (!contentLength) {
    return false;
  }

  const bytes = Number(contentLength);
  return Number.isFinite(bytes) && bytes > MAX_RESPONSE_BYTES;
}

/** URL에서 정적 HTML을 읽고 Readability로 공고 본문을 추출한다. */
export async function fetchPosting(
  rawUrl: string,
  deps: FetchPostingDeps = {},
): Promise<PostingFetchResult> {
  const initialUrl = checkPostingUrl(rawUrl);
  if (!initialUrl.ok) {
    return failure("blocked-url");
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const abort = () => controller.abort(deps.signal?.reason);
  if (deps.signal?.aborted) abort();
  else deps.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let currentUrl = initialUrl.url;
    let redirectCount = 0;
    let response: Response;

    while (true) {
      controller.signal.throwIfAborted();
      response = await fetchImpl(currentUrl, {
        headers: { "User-Agent": BROWSER_USER_AGENT },
        redirect: "manual",
        signal: controller.signal,
      });

      if (!isRedirect(response.status)) {
        break;
      }

      if (redirectCount >= MAX_REDIRECTS) {
        return failure("fetch-failed");
      }

      const location = response.headers.get("location");
      if (!location) {
        return failure("fetch-failed");
      }

      let redirectUrl: URL;
      try {
        redirectUrl = new URL(location, currentUrl);
      } catch {
        return failure("fetch-failed");
      }

      const guardedRedirect = checkPostingUrl(redirectUrl.href);
      if (!guardedRedirect.ok) {
        return failure("blocked-url");
      }

      currentUrl = guardedRedirect.url;
      redirectCount += 1;
    }

    if (!response.ok) {
      return failure("fetch-failed");
    }

    if (!isHtmlContentType(response.headers.get("content-type"))) {
      return failure("not-html");
    }

    const contentLength = response.headers.get("content-length");
    if (responseIsTooLarge(contentLength)) {
      return failure("fetch-failed");
    }

    // Content-Length가 없는 응답도 같은 상한까지만 파싱한다. 공고 본문 길이는 추출 뒤 truncatePostingText가 자른다
    const html = (await response.text()).slice(0, MAX_RESPONSE_BYTES);
    const dom = new JSDOM(html, { url: currentUrl.href });
    const documentTitle = dom.window.document.title.trim();
    const article = new Readability(dom.window.document).parse();
    const rawText = normalizePostingText(article?.textContent ?? "");

    if (!isExtractionSufficient(rawText)) {
      return failure("too-short");
    }

    return {
      ok: true,
      posting: {
        sourceUrl: currentUrl.href,
        rawText: truncatePostingText(rawText),
      },
      title: article?.title?.trim() || documentTitle || currentUrl.hostname,
    };
  } catch {
    return failure("fetch-failed");
  } finally {
    clearTimeout(timeout);
    deps.signal?.removeEventListener("abort", abort);
  }
}

/** 붙여넣은 공고를 네트워크 호출 없이 검증하고 정규화한다. */
export function postingFromPastedText(text: string): PostingFetchResult {
  const rawText = normalizePostingText(text);
  if (!isExtractionSufficient(rawText)) {
    return { ok: false, reason: "too-short", message: PASTED_TOO_SHORT_MESSAGE };
  }

  return {
    ok: true,
    posting: { rawText: truncatePostingText(rawText) },
    title: "붙여넣은 공고",
  };
}
