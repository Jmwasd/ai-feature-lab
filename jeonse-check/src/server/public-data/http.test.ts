import { describe, expect, it, vi } from "vitest";
import { createFakeFetch } from "./__fixtures__/load";
import { type FetchLike, getJson, getText, PublicDataError, redactUrl } from "./http";

// data.go.kr Decoding 키처럼 +, /, = 가 섞인 값. 인코딩된 형태로도 새면 안 된다.
const SECRET = "Ab+Cd/Ef==SECRET";
const SECRET_ENCODED = encodeURIComponent(SECRET);

function urlWithKey(param = "serviceKey"): URL {
  const url = new URL("https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent");
  url.searchParams.set(param, SECRET);
  url.searchParams.set("LAWD_CD", "11110");
  return url;
}

// 에러 객체의 메시지·필드 어디에도 키 원문이 없어야 한다.
function expectNoSecret(error: unknown): void {
  const e = error as Error;
  const dump = `${e.message} ${e.stack ?? ""} ${JSON.stringify(e)} ${String(e.cause ?? "")}`;
  expect(dump).not.toContain(SECRET);
  expect(dump).not.toContain(SECRET_ENCODED);
}

async function catchError(promise: Promise<unknown>): Promise<PublicDataError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(PublicDataError);
    return error as PublicDataError;
  }
  throw new Error("예외가 발생하지 않았다");
}

const noDelay = { retryDelayMs: 0 };

describe("redactUrl", () => {
  it.each(["serviceKey", "key", "confmKey"])("%s 쿼리 값을 가린다", (param) => {
    const redacted = redactUrl(urlWithKey(param));
    expect(redacted).not.toContain(SECRET);
    expect(redacted).not.toContain(SECRET_ENCODED);
    expect(redacted).toContain(`${param}=***`);
    expect(redacted).toContain("LAWD_CD=11110");
  });

  it("쿼리 이름의 대소문자가 달라도 가린다", () => {
    const url = new URL("https://example.com/api");
    url.searchParams.set("ServiceKey", SECRET);
    url.searchParams.set("KEY", SECRET);
    expect(redactUrl(url)).not.toContain(SECRET_ENCODED);
  });

  it("원본 URL을 바꾸지 않는다", () => {
    const url = urlWithKey();
    redactUrl(url);
    expect(url.searchParams.get("serviceKey")).toBe(SECRET);
  });
});

describe("getText", () => {
  it("성공하면 본문 문자열을 돌려준다", async () => {
    const fetch = createFakeFetch({
      "/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent": { body: "<response/>" },
    });
    await expect(getText(urlWithKey(), { source: "molit-trade", fetch })).resolves.toBe(
      "<response/>",
    );
    expect(fetch.calls).toHaveLength(1);
  });

  it("타임아웃되면 kind timeout으로 실패한다", async () => {
    const fetch: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    const error = await catchError(
      getText(urlWithKey(), { source: "molit-trade", fetch, timeoutMs: 10, retries: 0 }),
    );
    expect(error.kind).toBe("timeout");
    expect(error.source).toBe("molit-trade");
    expectNoSecret(error);
  });

  it("타임아웃은 재시도한다", async () => {
    let calls = 0;
    const fetch: FetchLike = (_url, init) => {
      calls += 1;
      if (calls === 1) {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        });
      }
      return Promise.resolve(new Response("ok"));
    };
    await expect(
      getText(urlWithKey(), { source: "vworld", fetch, timeoutMs: 10, retries: 1, ...noDelay }),
    ).resolves.toBe("ok");
    expect(calls).toBe(2);
  });

  it("5xx면 재시도하고, 다음 시도가 성공하면 결과를 돌려준다", async () => {
    const responses = [
      new Response("err", { status: 503 }),
      new Response("err", { status: 500 }),
      new Response("<ok/>", { status: 200 }),
    ];
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(responses.shift()!));
    await expect(
      getText(urlWithKey(), { source: "building", fetch, retries: 2, ...noDelay }),
    ).resolves.toBe("<ok/>");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("5xx가 재시도 횟수를 넘으면 kind http로 실패한다", async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(new Response("err", { status: 502 })));
    const error = await catchError(
      getText(urlWithKey(), { source: "building", fetch, retries: 2, ...noDelay }),
    );
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(error.kind).toBe("http");
    expect(error.status).toBe(502);
    expectNoSecret(error);
  });

  it("네트워크 오류는 재시도한다", async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockRejectedValueOnce(new TypeError(`fetch failed ${SECRET}`))
      .mockResolvedValueOnce(new Response("ok"));
    await expect(
      getText(urlWithKey(), { source: "juso", fetch, retries: 1, ...noDelay }),
    ).resolves.toBe("ok");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("네트워크 오류가 계속되면 원인 메시지의 키도 새지 않는다", async () => {
    const fetch = vi.fn<FetchLike>(() =>
      Promise.reject(new TypeError(`connect failed ${urlWithKey().toString()}`)),
    );
    const error = await catchError(
      getText(urlWithKey(), { source: "juso", fetch, retries: 1, ...noDelay }),
    );
    expect(error.kind).toBe("http");
    expectNoSecret(error);
  });

  it("4xx는 재시도하지 않고 즉시 실패한다", async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(new Response("bad", { status: 400 })));
    const error = await catchError(
      getText(urlWithKey(), { source: "vworld", fetch, retries: 3, ...noDelay }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(error.kind).toBe("http");
    expect(error.status).toBe(400);
  });

  it("429는 kind quota로 즉시 실패한다", async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(new Response("", { status: 429 })));
    const error = await catchError(
      getText(urlWithKey(), { source: "molit-trade", fetch, retries: 3, ...noDelay }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(error.kind).toBe("quota");
  });

  it("오류 메시지에는 가린 URL이 들어가고 키 원문은 없다", async () => {
    const fetch = createFakeFetch({});
    const error = await catchError(getText(urlWithKey(), { source: "molit-trade", fetch }));
    expect(error.message).toContain("serviceKey=***");
    expect(error.url).toContain("serviceKey=***");
    expectNoSecret(error);
  });
});

describe("getJson", () => {
  it("JSON 본문을 파싱한다", async () => {
    const fetch = createFakeFetch({ "/addrlink/addrLinkApi.do": { body: '{"results":{"a":1}}' } });
    const url = new URL("https://business.juso.go.kr/addrlink/addrLinkApi.do");
    url.searchParams.set("confmKey", SECRET);
    await expect(getJson(url, { source: "juso", fetch })).resolves.toEqual({ results: { a: 1 } });
  });

  it("JSON이 아니면 kind parse로 실패한다", async () => {
    const fetch = createFakeFetch({ "/addrlink/addrLinkApi.do": { body: "<xml>not json</xml>" } });
    const url = new URL("https://business.juso.go.kr/addrlink/addrLinkApi.do");
    url.searchParams.set("confmKey", SECRET);
    const error = await catchError(getJson(url, { source: "juso", fetch }));
    expect(error.kind).toBe("parse");
    expect(error.source).toBe("juso");
    expectNoSecret(error);
  });
});
