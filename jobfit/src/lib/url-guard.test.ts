import { describe, expect, it } from "vitest";

import { checkPostingUrl } from "./url-guard";

describe("checkPostingUrl", () => {
  it.each(["https://example.com/jobs/1", "http://example.com"])(
    "accepts a public HTTP(S) URL: %s",
    (raw) => {
      const result = checkPostingUrl(raw);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.url).toBeInstanceOf(URL);
        expect(result.url.href).toBe(new URL(raw).href);
      }
    },
  );

  it.each(["ftp://example.com", "file:///etc/passwd", "javascript:alert(1)"])(
    "rejects a non-HTTP scheme: %s",
    (raw) => {
      expect(checkPostingUrl(raw)).toEqual({ ok: false, reason: "scheme" });
    },
  );

  it.each(["not a url", ""])("rejects an invalid URL: %s", (raw) => {
    expect(checkPostingUrl(raw)).toEqual({ ok: false, reason: "invalid" });
  });

  it.each([
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://[::1]",
    "http://0.0.0.0",
  ])("rejects a local host: %s", (raw) => {
    expect(checkPostingUrl(raw)).toEqual({ ok: false, reason: "private-host" });
  });

  it.each([
    "http://10.1.2.3",
    "http://172.16.0.1",
    "http://192.168.0.1",
    "http://169.254.169.254",
  ])("rejects a private or link-local IPv4 address: %s", (raw) => {
    expect(checkPostingUrl(raw)).toEqual({ ok: false, reason: "private-host" });
  });

  it("accepts an address outside the 172.16.0.0/12 private range", () => {
    expect(checkPostingUrl("http://172.32.0.1").ok).toBe(true);
  });
});
