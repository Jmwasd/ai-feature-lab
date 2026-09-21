export function sanitizeNext(value: string | null | undefined): string | null {
  if (!value?.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  // URL parsing strips tabs/newlines; reject them before a path can become an external URL.
  if (Array.from(value).some((char) => char.charCodeAt(0) <= 0x1f || char.charCodeAt(0) === 0x7f)) return null;
  return value;
}
