import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoForbiddenPhrases } from "@/test/forbidden-phrases";
import NotFound from "./not-found";

describe("404", () => {
  it("페이지가 없다는 안내와 처음으로 가는 링크를 보여 준다", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { level: 1, name: "페이지를 찾을 수 없어요" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "처음으로" })).toHaveAttribute("href", "/");
    expectNoForbiddenPhrases(document.body.textContent ?? "");
  });
});
