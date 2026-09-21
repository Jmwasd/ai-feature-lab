import type { CommitDetail } from "@/types/git";

const DIFF_BYTE_LIMIT = 204_800;

export function buildSummaryInput(detail: CommitDetail, patch: string): { text: string; truncated: boolean } {
  const bytes = Buffer.from(patch, "utf8");
  const truncated = bytes.length > DIFF_BYTE_LIMIT;
  let end = Math.min(bytes.length, DIFF_BYTE_LIMIT);
  // If the first excluded byte is a continuation byte, exclude its whole character.
  if (truncated) {
    while ((bytes[end] & 0xc0) === 0x80) end--;
  }
  const numstat = detail.files.map((file) => {
    const path = file.oldPath === undefined ? file.path : `${file.oldPath} => ${file.path}`;
    return `${file.additions ?? "-"}\t${file.deletions ?? "-"}\t${path}`;
  }).join("\n");
  const message = detail.subject + (detail.body ? `\n\n${detail.body}` : "");
  const notice = truncated ? "\n\n주의: diff가 잘렸다. UTF-8 200KB까지의 앞부분만 제공되므로 요약이 일부 변경에 치우칠 수 있다." : "";
  return {
    text: `커밋 메시지:\n${message}\n\n전체 파일 numstat (추가\t삭제\t경로, -는 바이너리):\n${numstat}${notice}\n\nDiff:\n${bytes.subarray(0, end).toString("utf8")}`,
    truncated,
  };
}
