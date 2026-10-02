import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Reveal } from "./Reveal";

describe("Reveal", () => {
  it("appear면 숨긴 상태(opacity 0·아래 16px·blur)로 그린 뒤 다음 프레임에 보이는 상태로 전환한다", async () => {
    render(
      <Reveal appear className="flex">
        내용
      </Reveal>,
    );
    const box = screen.getByText("내용");

    expect(box).toHaveClass("flex", "opacity-0", "translate-y-4", "blur-xs", "ease-rise");
    await waitFor(() => expect(box).toHaveClass("opacity-100", "translate-y-0", "blur-none"));
  });

  it("appear가 아니면 처음부터 보이는 상태로 그린다", () => {
    render(<Reveal appear={false}>내용</Reveal>);

    expect(screen.getByText("내용")).toHaveClass("opacity-100", "translate-y-0");
  });
});
