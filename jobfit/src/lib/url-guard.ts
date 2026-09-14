export type UrlGuardResult =
  | { ok: true; url: URL }
  | { ok: false; reason: "invalid" | "scheme" | "private-host" };

function isBlockedIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);

  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  const [first, second] = octets;

  return (
    first === 127 ||
    (first === 0 && second === 0 && octets[2] === 0 && octets[3] === 0) ||
    first === 10 ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

export function checkPostingUrl(raw: string): UrlGuardResult {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "scheme" };
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    isBlockedIpv4(hostname)
  ) {
    return { ok: false, reason: "private-host" };
  }

  return { ok: true, url };
}
