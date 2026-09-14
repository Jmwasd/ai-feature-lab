/** 데이터 구획 태그가 본문 안에서 열리거나 닫히는 것을 막는다. */
export function sanitizeDataBlock(text: string, tag: string): string {
  if (tag.length === 0) {
    return text;
  }

  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundaryTag = new RegExp(`<\\/?${escapedTag}>`, "gi");

  return text.replace(boundaryTag, (match) => `＜${match.slice(1)}`);
}
