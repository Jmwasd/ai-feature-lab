import type { ResumeEvidence } from "@/types";

export interface NotionBlockNode {
  id: string;
  type: string;
  text: string;
  children: NotionBlockNode[];
}

export const MIN_EVIDENCE_LENGTH = 15;

const EVIDENCE_TYPES = new Set([
  "bulleted_list_item",
  "numbered_list_item",
  "paragraph",
  "toggle",
]);

const SKIPPED_SUBTREE_TYPES = new Set(["column_list", "column"]);

interface Ownership {
  company: string;
  project: string;
}

function companyName(heading: string): string {
  return heading.replace(/\s*\([^)]*\)/, "").trim();
}

function evidenceText(block: NotionBlockNode): string {
  const codeTexts = block.children
    .filter((child) => child.type === "code")
    .map((child) => child.text);

  return [block.text, ...codeTexts].join("\n");
}

export function parseResume(blocks: NotionBlockNode[]): ResumeEvidence[] {
  const evidence: ResumeEvidence[] = [];
  const seenBlockIds = new Set<string>();
  const ownership: Ownership = { company: "", project: "" };

  const visit = (block: NotionBlockNode): void => {
    if (SKIPPED_SUBTREE_TYPES.has(block.type)) {
      return;
    }

    if (block.type === "heading_2") {
      ownership.company = companyName(block.text);
      ownership.project = "";
    } else if (block.type === "heading_3") {
      ownership.project = block.text;
    } else if (EVIDENCE_TYPES.has(block.type)) {
      const text = evidenceText(block);

      if (
        text.trim().length > 0 &&
        text.length >= MIN_EVIDENCE_LENGTH &&
        !seenBlockIds.has(block.id)
      ) {
        evidence.push({
          blockId: block.id,
          text,
          company: ownership.company,
          project: ownership.project,
        });
        seenBlockIds.add(block.id);
      }
    }

    for (const child of block.children) {
      if (child.type !== "code") {
        visit(child);
      }
    }
  };

  for (const block of blocks) {
    visit(block);
  }

  return evidence;
}
