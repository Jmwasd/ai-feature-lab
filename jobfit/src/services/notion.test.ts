import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  fetchBlockTree,
  getResumeEvidence,
  type BlockListPage,
  type BlockLister,
} from "./notion";

interface NotionBlock {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
}

const block = (
  id: string,
  type: string,
  options: { hasChildren?: boolean; richText?: string[] } = {},
): NotionBlock => ({
  id,
  type,
  has_children: options.hasChildren ?? false,
  [type]: options.richText
    ? { rich_text: options.richText.map((plain_text) => ({ plain_text })) }
    : {},
});

function fakeLister(pages: Record<string, BlockListPage[]>): BlockLister & { calls: Array<{ blockId: string; startCursor?: string }> } {
  const calls: Array<{ blockId: string; startCursor?: string }> = [];

  return {
    calls,
    async list(args) {
      calls.push(args);
      const page = pages[`${args.blockId}:${args.startCursor ?? "first"}`]?.[0];
      if (!page) {
        throw new Error(`Unexpected list call: ${args.blockId}:${args.startCursor ?? "first"}`);
      }
      return page;
    },
  };
}

const page = (results: unknown[], hasMore = false, nextCursor: string | null = null): BlockListPage => ({
  results,
  hasMore,
  nextCursor,
});

describe("fetchBlockTree", () => {
  it("recursively follows blocks with children", async () => {
    const lister = fakeLister({
      "root:first": [page([block("parent", "bulleted_list_item", { hasChildren: true })])],
      "parent:first": [page([block("child", "code", { richText: ["Docker", " CI"] })])],
    });

    await expect(fetchBlockTree(lister, "root")).resolves.toEqual([
      {
        id: "parent",
        type: "bulleted_list_item",
        text: "",
        children: [{ id: "child", type: "code", text: "Docker CI", children: [] }],
      },
    ]);
  });

  it("collects every pagination page before normalizing the parent children", async () => {
    const lister = fakeLister({
      "root:first": [page([block("first", "paragraph", { richText: ["first"] })], true, "cursor-2")],
      "root:cursor-2": [page([block("second", "paragraph", { richText: ["second"] })])],
    });

    const tree = await fetchBlockTree(lister, "root");

    expect(tree.map(({ id }) => id)).toEqual(["first", "second"]);
    expect(lister.calls).toEqual([
      { blockId: "root" },
      { blockId: "root", startCursor: "cursor-2" },
    ]);
  });

  it("joins rich text fragments and handles code rich text", async () => {
    const lister = fakeLister({
      "root:first": [
        page([
          block("paragraph", "paragraph", { richText: ["여러 ", "조각"] }),
          block("code", "code", { richText: ["const ", "value = 1"] }),
        ]),
      ],
    });

    await expect(fetchBlockTree(lister, "root")).resolves.toEqual([
      { id: "paragraph", type: "paragraph", text: "여러 조각", children: [] },
      { id: "code", type: "code", text: "const value = 1", children: [] },
    ]);
  });

  it("does not descend beyond depth six", async () => {
    const lister = fakeLister({
      "root:first": [page([block("depth-0", "toggle", { hasChildren: true })])],
      "depth-0:first": [page([block("depth-1", "toggle", { hasChildren: true })])],
      "depth-1:first": [page([block("depth-2", "toggle", { hasChildren: true })])],
      "depth-2:first": [page([block("depth-3", "toggle", { hasChildren: true })])],
      "depth-3:first": [page([block("depth-4", "toggle", { hasChildren: true })])],
      "depth-4:first": [page([block("depth-5", "toggle", { hasChildren: true })])],
      "depth-5:first": [page([block("depth-6", "toggle", { hasChildren: true })])],
    });

    const tree = await fetchBlockTree(lister, "root");
    let leaf = tree[0];
    while (leaf?.children[0]) {
      leaf = leaf.children[0];
    }

    expect(leaf?.id).toBe("depth-6");
    expect(leaf?.children).toEqual([]);
    expect(lister.calls.map(({ blockId }) => blockId)).not.toContain("depth-6");
  });

  it("never requests children for blocks without has_children", async () => {
    const lister = fakeLister({
      "root:first": [page([block("leaf", "image"), block("other-leaf", "divider")])],
    });

    await fetchBlockTree(lister, "root");

    expect(lister.calls).toEqual([{ blockId: "root" }]);
  });
});

describe("getResumeEvidence", () => {
  const originalToken = process.env.NOTION_TOKEN;
  const originalPageId = process.env.NOTION_RESUME_PAGE_ID;

  beforeEach(() => {
    delete process.env.NOTION_TOKEN;
    delete process.env.NOTION_RESUME_PAGE_ID;
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.NOTION_TOKEN;
    } else {
      process.env.NOTION_TOKEN = originalToken;
    }

    if (originalPageId === undefined) {
      delete process.env.NOTION_RESUME_PAGE_ID;
    } else {
      process.env.NOTION_RESUME_PAGE_ID = originalPageId;
    }
  });

  it("names NOTION_TOKEN when it is not configured", async () => {
    await expect(getResumeEvidence()).rejects.toThrow("NOTION_TOKEN");
  });

  it("names NOTION_RESUME_PAGE_ID when it is not configured", async () => {
    process.env.NOTION_TOKEN = "test-token";

    await expect(getResumeEvidence()).rejects.toThrow("NOTION_RESUME_PAGE_ID");
  });

});
