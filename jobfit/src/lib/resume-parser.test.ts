import { describe, expect, it } from "vitest";

import { MIN_EVIDENCE_LENGTH, parseResume, type NotionBlockNode } from "./resume-parser";

const node = (
  id: string,
  type: string,
  text: string,
  children: NotionBlockNode[] = [],
): NotionBlockNode => ({ id, type, text, children });

describe("parseResume", () => {
  it("removes the H2 period suffix while retaining the H3 project description", () => {
    const evidence = parseResume([
      node("company", "heading_2", "소프트보울 ( 2024. 02 - 재직중 )"),
      node("project", "heading_3", "Bidbowl (맞춤형 공공 입찰 정보 구독 플랫폼)"),
      node("bullet", "bulleted_list_item", "공고 분석에 충분히 긴 이력서 근거 문장입니다."),
    ]);

    expect(evidence).toEqual([
      {
        blockId: "bullet",
        text: "공고 분석에 충분히 긴 이력서 근거 문장입니다.",
        company: "소프트보울",
        project: "Bidbowl (맞춤형 공공 입찰 정보 구독 플랫폼)",
      },
    ]);
  });

  it("appends direct child code blocks to their parent evidence and keeps the parent anchor", () => {
    const evidence = parseResume([
      node("bullet", "bulleted_list_item", "인프라 구축", [
        node("code-one", "code", "Docker 멀티 스테이지 빌드와 배포 자동화를 구축했습니다."),
        node("code-two", "code", "GitHub Actions 기반 CI/CD 파이프라인을 운영했습니다."),
      ]),
    ]);

    expect(evidence).toEqual([
      {
        blockId: "bullet",
        text: "인프라 구축\nDocker 멀티 스테이지 빌드와 배포 자동화를 구축했습니다.\nGitHub Actions 기반 CI/CD 파이프라인을 운영했습니다.",
        company: "",
        project: "",
      },
    ]);
    expect(evidence.map(({ blockId }) => blockId)).not.toContain("code-one");
    expect(evidence.map(({ blockId }) => blockId)).not.toContain("code-two");
  });

  it("keeps a short candidate when absorbed code brings it above the minimum length", () => {
    const evidence = parseResume([
      node("short-bullet", "bulleted_list_item", "배포", [
        node("code", "code", "자동화된 배포 파이프라인을 구축하고 안정적으로 운영했습니다."),
      ]),
    ]);

    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.text.length).toBeGreaterThanOrEqual(MIN_EVIDENCE_LENGTH);
  });

  it("drops candidates that remain shorter than the minimum length after code absorption", () => {
    const evidence = parseResume([
      node("short-bullet", "bulleted_list_item", "짧음", [node("code", "code", "더 짧음")]),
    ]);

    expect(evidence).toEqual([]);
  });

  it("skips an entire column_list subtree", () => {
    const evidence = parseResume([
      node("columns", "column_list", "", [
        node("column", "column", "", [
          node("hidden", "bulleted_list_item", "연락처와 사진을 포함한 긴 개인 정보 근거입니다."),
        ]),
      ]),
      node("visible", "paragraph", "이 블록만 이력서 근거로 남아야 합니다."),
    ]);

    expect(evidence.map(({ blockId }) => blockId)).toEqual(["visible"]);
  });

  it.each(["image", "divider"])("excludes %s blocks", (type) => {
    const evidence = parseResume([
      node(`${type}-id`, type, "실수로 표시되면 안 되는 충분히 긴 텍스트입니다."),
    ]);

    expect(evidence).toEqual([]);
  });

  it("resets the project when it reaches a new H2", () => {
    const evidence = parseResume([
      node("company-one", "heading_2", "첫 번째 회사 ( 2020 - 2024 )"),
      node("project-one", "heading_3", "첫 프로젝트"),
      node("first-evidence", "paragraph", "첫 회사의 첫 프로젝트에 속한 충분히 긴 근거입니다."),
      node("company-two", "heading_2", "두 번째 회사 ( 2024 - 재직중 )"),
      node("second-evidence", "paragraph", "새 회사에 속하지만 프로젝트가 없는 충분히 긴 근거입니다."),
    ]);

    expect(evidence[1]).toMatchObject({ company: "두 번째 회사", project: "" });
  });

  it("treats nested non-code candidates as their own evidence with inherited ownership", () => {
    const evidence = parseResume([
      node("company", "heading_2", "소프트보울 ( 2024 - 재직중 )"),
      node("project", "heading_3", "Bidbowl"),
      node("parent", "bulleted_list_item", "부모 불릿도 충분히 긴 독립 근거로 남아야 합니다.", [
        node("child", "bulleted_list_item", "중첩 불릿도 동일한 소속을 물려받는 독립 근거입니다."),
      ]),
    ]);

    expect(evidence).toEqual([
      expect.objectContaining({ blockId: "parent", company: "소프트보울", project: "Bidbowl" }),
      expect.objectContaining({ blockId: "child", company: "소프트보울", project: "Bidbowl" }),
    ]);
  });

  it("keeps evidence before the first H2 without ownership", () => {
    const evidence = parseResume([
      node("summary", "paragraph", "문서 상단에 있는 기술 스택 요약도 충분히 긴 근거입니다."),
    ]);

    expect(evidence).toEqual([
      expect.objectContaining({ blockId: "summary", company: "", project: "" }),
    ]);
  });

  it("keeps only the first appearance of a duplicate block ID", () => {
    const evidence = parseResume([
      node("duplicate", "paragraph", "먼저 나온 충분히 긴 근거 텍스트는 유지되어야 합니다."),
      node("duplicate", "paragraph", "나중에 나온 충분히 긴 근거 텍스트는 버려져야 합니다."),
    ]);

    expect(evidence).toEqual([
      expect.objectContaining({ blockId: "duplicate", text: "먼저 나온 충분히 긴 근거 텍스트는 유지되어야 합니다." }),
    ]);
  });
});
