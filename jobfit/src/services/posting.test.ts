import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchPosting, postingFromPastedText } from "./posting";

const PASTE_GUIDANCE = "공고 내용을 복사해 붙여넣어 주세요";

function articleHtml(text: string, title = "Backend Engineer"): string {
  return `<!doctype html>
    <html>
      <head><title>${title}</title></head>
      <body>
        <article>
          <h1>${title}</h1>
          <p>${text}</p>
        </article>
      </body>
    </html>`;
}

const longPostingText =
  "백엔드 서비스를 설계하고 운영하며 동료와 함께 안정적인 제품을 만듭니다. "
    .repeat(12)
    .trim();

describe("fetchPosting", () => {
  it("extracts readable text from a normal HTML response", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(articleHtml(longPostingText), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );

    const result = await fetchPosting("https://jobs.example.com/backend", { fetchImpl });

    expect(result).toEqual({
      ok: true,
      posting: {
        sourceUrl: "https://jobs.example.com/backend",
        rawText: expect.stringContaining("백엔드 서비스를 설계하고 운영하며"),
      },
      title: "Backend Engineer",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("blocks a private URL before fetch is called", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    const result = await fetchPosting("http://127.0.0.1/x", { fetchImpl });

    expect(result).toMatchObject({ ok: false, reason: "blocked-url" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks a redirect to a private URL before the second fetch", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data" },
      }),
    );

    const result = await fetchPosting("https://jobs.example.com/redirect", { fetchImpl });

    expect(result).toMatchObject({ ok: false, reason: "blocked-url" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("returns fetch-failed for an HTTP error", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("Not Found", { status: 404 }));

    await expect(fetchPosting("https://jobs.example.com/missing", { fetchImpl })).resolves.toMatchObject({
      ok: false,
      reason: "fetch-failed",
    });
  });

  it("rejects a non-HTML response", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("%PDF", {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }),
    );

    await expect(fetchPosting("https://jobs.example.com/spec.pdf", { fetchImpl })).resolves.toMatchObject({
      ok: false,
      reason: "not-html",
    });
  });

  it("returns too-short with paste guidance for insufficient article text", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(articleHtml("짧은 공고입니다."), {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    const result = await fetchPosting("https://jobs.example.com/short", { fetchImpl });

    expect(result).toMatchObject({ ok: false, reason: "too-short" });
    if (!result.ok) {
      expect(result.message).toContain(PASTE_GUIDANCE);
    }
  });
});

describe("postingFromPastedText", () => {
  it("rejects short text and accepts sufficient text without a sourceUrl", () => {
    const shortResult = postingFromPastedText("짧은 공고입니다.");
    const successResult = postingFromPastedText(longPostingText);

    expect(shortResult).toMatchObject({ ok: false, reason: "too-short" });
    expect(successResult).toMatchObject({
      ok: true,
      posting: { rawText: longPostingText },
    });
    if (successResult.ok) {
      expect(successResult.posting).not.toHaveProperty("sourceUrl");
    }
  });
});
