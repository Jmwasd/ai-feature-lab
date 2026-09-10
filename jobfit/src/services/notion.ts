import "server-only";

import { Client } from "@notionhq/client";

import { parseResume, type NotionBlockNode } from "@/lib/resume-parser";
import type { ResumeEvidence } from "@/types";

const MAX_BLOCK_DEPTH = 6;
const NOTION_PAGE_SIZE = 100;

export interface BlockLister {
  list(args: { blockId: string; startCursor?: string }): Promise<BlockListPage>;
}

export interface BlockListPage {
  results: unknown[];
  hasMore: boolean;
  nextCursor: string | null;
}

function richTextFrom(block: Record<string, unknown>, type: string): string {
  const payload = block[type];
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const richText = (payload as Record<string, unknown>).rich_text;
  if (!Array.isArray(richText)) {
    return "";
  }

  return richText
    .map((fragment) => {
      if (!fragment || typeof fragment !== "object") {
        return "";
      }

      const plainText = (fragment as Record<string, unknown>).plain_text;
      return typeof plainText === "string" ? plainText : "";
    })
    .join("");
}

function normalizeBlock(rawBlock: unknown, children: NotionBlockNode[]): NotionBlockNode {
  const block = rawBlock && typeof rawBlock === "object" ? (rawBlock as Record<string, unknown>) : {};
  const id = typeof block.id === "string" ? block.id : "";
  const type = typeof block.type === "string" ? block.type : "";

  return {
    id,
    type,
    text: richTextFrom(block, type),
    children,
  };
}

async function listAllChildren(lister: BlockLister, blockId: string): Promise<unknown[]> {
  const results: unknown[] = [];
  let startCursor: string | undefined;

  do {
    const page = await lister.list({ blockId, ...(startCursor ? { startCursor } : {}) });
    results.push(...page.results);

    if (page.hasMore && !page.nextCursor) {
      throw new Error(`Notion returned hasMore without nextCursor for block ${blockId}`);
    }

    startCursor = page.hasMore ? page.nextCursor ?? undefined : undefined;
  } while (startCursor);

  return results;
}

/** 블록 트리를 재귀 순회해 파서가 먹는 형태로 정규화한다. */
export async function fetchBlockTree(lister: BlockLister, rootId: string): Promise<NotionBlockNode[]> {
  const fetchChildren = async (blockId: string, depth: number): Promise<NotionBlockNode[]> => {
    const rawBlocks = await listAllChildren(lister, blockId);
    const nodes: NotionBlockNode[] = [];

    for (const rawBlock of rawBlocks) {
      const block = rawBlock && typeof rawBlock === "object" ? (rawBlock as Record<string, unknown>) : {};
      const id = typeof block.id === "string" ? block.id : "";
      const hasChildren = block.has_children === true;
      const children = hasChildren && depth < MAX_BLOCK_DEPTH ? await fetchChildren(id, depth + 1) : [];

      nodes.push(normalizeBlock(rawBlock, children));
    }

    return nodes;
  };

  return fetchChildren(rootId, 0);
}

function requireNotionConfig(): { token: string; resumePageId: string } {
  const token = process.env.NOTION_TOKEN;
  const resumePageId = process.env.NOTION_RESUME_PAGE_ID;

  if (!token) {
    throw new Error("Missing required environment variable: NOTION_TOKEN");
  }

  if (!resumePageId) {
    throw new Error("Missing required environment variable: NOTION_RESUME_PAGE_ID");
  }

  return { token, resumePageId };
}

/** 환경 변수를 읽어 실제 Notion을 호출하고 근거 목록까지 만든다. */
export async function getResumeEvidence(): Promise<ResumeEvidence[]> {
  const { token, resumePageId } = requireNotionConfig();
  const notion = new Client({ auth: token });
  const lister: BlockLister = {
    async list({ blockId, startCursor }) {
      const response = await notion.blocks.children.list({
        block_id: blockId,
        page_size: NOTION_PAGE_SIZE,
        ...(startCursor ? { start_cursor: startCursor } : {}),
      });

      return {
        results: response.results,
        hasMore: response.has_more,
        nextCursor: response.next_cursor,
      };
    },
  };

  return parseResume(await fetchBlockTree(lister, resumePageId));
}
