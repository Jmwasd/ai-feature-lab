import { sanitizeNext } from "./auth/next";

export type LandingView =
  | { kind: "landing" }
  | { kind: "blocked"; next: string }
  | { kind: "login"; next: string | null };

export function pickLandingView(params: {
  next?: string | string[];
  login?: string | string[];
}): LandingView {
  const next = sanitizeNext(typeof params.next === "string" ? params.next : null);
  if (Object.prototype.hasOwnProperty.call(params, "login")) return { kind: "login", next };
  return next ? { kind: "blocked", next } : { kind: "landing" };
}
