import { describe, expect, it } from "vitest";
import { pickLandingView } from "./landing";

describe("pickLandingView", () => {
  it("shows the landing page without query parameters", () => {
    expect(pickLandingView({})).toEqual({ kind: "landing" });
  });

  it("shows the blocked screen and preserves an internal destination", () => {
    const next = "/repo/abcdef0?file=문서#diff";
    expect(pickLandingView({ next })).toEqual({ kind: "blocked", next });
  });

  it.each(["", "true", ["", "true"]])("selects login by key presence (%j)", (login) => {
    expect(pickLandingView({ login })).toEqual({ kind: "login", next: null });
  });

  it("gives login precedence while preserving the destination", () => {
    expect(pickLandingView({ login: "", next: "/repo" })).toEqual({ kind: "login", next: "/repo" });
  });

  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "/\n/evil.com", "repo", ""]) (
    "discards unsafe or empty next %j in both screens", (next) => {
      expect(pickLandingView({ next })).toEqual({ kind: "landing" });
      expect(pickLandingView({ login: "", next })).toEqual({ kind: "login", next: null });
    },
  );

  it("discards ambiguous repeated next parameters", () => {
    const next = ["/repo", "//evil.com"];
    expect(pickLandingView({ next })).toEqual({ kind: "landing" });
    expect(pickLandingView({ login: "", next })).toEqual({ kind: "login", next: null });
  });
});
