import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatLog, type ChatLogData } from "./ChatLog";

const DATA: ChatLogData = {
  project: "jeonse-check",
  generatedAt: "2026-10-14 00:07",
  questionCount: 3,
  sessions: [
    {
      id: "aaaa1111",
      date: "2026-09-27",
      startedAt: "15:42",
      endedAt: "15:50",
      branch: "main",
      model: "claude-opus-5-5",
      source: "Claude Code",
      pairs: [
        { askedAt: "15:42", summary: "첫 질문", questionHtml: "<p>첫 질문</p>", answerHtml: "<p>첫 <code>답변</code></p>" },
        { askedAt: "15:45", summary: "둘째 질문", questionHtml: "<p>둘째 질문</p>", answerHtml: "<ul><li>둘째 답변</li></ul>" },
      ],
    },
    {
      id: "bbbb2222",
      date: "2026-10-13",
      startedAt: "23:00",
      endedAt: "23:30",
      branch: null,
      model: null,
      source: "Codex",
      pairs: [{ askedAt: "23:01", summary: "셋째 질문", questionHtml: "<p>셋째 질문</p>", answerHtml: "<p>셋째 답변</p>" }],
    },
  ],
};

describe("ChatLog", () => {
  it("세션 수·질문 수·생성 시각을 보여 준다", () => {
    render(<ChatLog data={DATA} />);

    expect(screen.getByRole("heading", { level: 1, name: "채팅 로그" })).toBeInTheDocument();
    expect(screen.getByText("세션 2개 · 질문 3개 · 2026-10-14 00:07 생성")).toBeInTheDocument();
  });

  it("목차는 날짜별로 질문 요약을 나열하고 본문 질문으로 연결한다", () => {
    render(<ChatLog data={DATA} />);

    const toc = screen.getByRole("navigation", { name: "대화 목차" });
    const links = within(toc).getAllByRole("link");
    const questionLinks = links.filter((link) => link.getAttribute("href")!.includes("-q"));
    expect(questionLinks.map((link) => link.getAttribute("href"))).toEqual(["#aaaa1111-q1", "#aaaa1111-q2", "#bbbb2222-q1"]);
    expect(within(toc).getByText("2026-10-13 · 1")).toBeInTheDocument();
    expect(document.getElementById("aaaa1111-q2")).toHaveTextContent("둘째 질문");
  });

  it("목차는 날짜 아래에 세션명을 두고 그 세션의 질문을 나열한다", () => {
    render(<ChatLog data={DATA} />);

    const toc = screen.getByRole("navigation", { name: "대화 목차" });
    const session = within(toc).getByRole("link", { name: "aaaa1111 15:42–15:50 · main" });
    expect(session).toHaveAttribute("href", "#aaaa1111");
    expect(within(toc).getByRole("link", { name: "bbbb2222 23:00–23:30" })).toHaveAttribute("href", "#bbbb2222");
  });

  it("좌측 패널 상단에 세션·질문·작업일·기간 요약 지표를 보여 준다", () => {
    render(<ChatLog data={DATA} />);

    const summary = screen.getByRole("list", { name: "요약 지표" });
    const items = within(summary).getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual(["2세션", "3질문", "2작업일", "17일기간"]);
    expect(within(summary).getByText("17일").closest("li")).toHaveAttribute("title", "2026-09-27 ~ 2026-10-13");
  });

  it("세션 머리에 시간·브랜치·모델·출처를 있는 것만 보여 준다", () => {
    render(<ChatLog data={DATA} />);

    expect(screen.getByText("15:42–15:50 KST · main · claude-opus-5-5 · Claude Code · 질문 2개")).toBeInTheDocument();
    expect(screen.getByText("23:00–23:30 KST · Codex · 질문 1개")).toBeInTheDocument();
  });

  it("질문과 답변 본문을 HTML 그대로 그린다", () => {
    render(<ChatLog data={DATA} />);

    const first = document.getElementById("aaaa1111-q1")!;
    expect(within(first).getByText("답변", { selector: "code" })).toBeInTheDocument();
    expect(within(document.getElementById("aaaa1111-q2")!).getByRole("listitem")).toHaveTextContent("둘째 답변");
  });
});
