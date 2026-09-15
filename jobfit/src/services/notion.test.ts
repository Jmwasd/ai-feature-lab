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
  it("never fetches column subtrees that the resume parser discards", async () => {
    const lister = fakeLister({
      "root:first": [page([
        block("contact", "column_list", { hasChildren: true }),
        block("photo", "column", { hasChildren: true }),
        block("experience", "bulleted_list_item", { hasChildren: true }),
      ])],
      "experience:first": [page([block("details", "code", { richText: ["Docker CI"] })])],
    });
    const tree = await fetchBlockTree(lister, "root");
    expect(lister.calls.map(({ blockId }) => blockId)).toEqual(["root", "experience"]);
    expect(tree[2].children[0].text).toBe("Docker CI");
  });

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

  it("leaves equation fragments out of the text so a decorative divider normalizes to empty", async () => {
    const lister = fakeLister({
      "root:first": [
        page([
          {
            id: "divider",
            type: "paragraph",
            has_children: false,
            paragraph: { rich_text: [{ type: "equation", plain_text: "\\large\\color{#d27b2d}━━" }] },
          },
          {
            id: "mixed",
            type: "paragraph",
            has_children: false,
            paragraph: {
              rich_text: [
                { type: "text", plain_text: "조회 성능을 " },
                { type: "equation", plain_text: "O(n)" },
                { type: "text", plain_text: "으로 개선" },
              ],
            },
          },
        ]),
      ],
    });

    await expect(fetchBlockTree(lister, "root")).resolves.toEqual([
      { id: "divider", type: "paragraph", text: "", children: [] },
      { id: "mixed", type: "paragraph", text: "조회 성능을 으로 개선", children: [] },
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
    vi.useRealTimers();
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

  it("aborts the actual fetch when the overall Notion read times out", async () => {
    vi.useFakeTimers();
    process.env.NOTION_TOKEN = "test-token";
    process.env.NOTION_RESUME_PAGE_ID = "test-page";
    let signal: AbortSignal | null | undefined;
    const fetchImpl = vi.fn<typeof fetch>((_url, init) => {
      signal = init?.signal;
      return new Promise((_resolve, reject) => signal?.addEventListener("abort", () => reject(signal?.reason), { once: true }));
    });
    const pending = expect(getResumeEvidence({ fetchImpl })).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(30_000);
    await pending;
    expect(signal?.aborted).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

});
