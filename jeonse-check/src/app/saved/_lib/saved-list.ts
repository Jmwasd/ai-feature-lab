import { headline } from "@/features/judgment/copy";
import type { SavedSummary } from "@/server/saved/repository";
import { formatIsoDate, formatSeoulDate } from "@/utils/format";

// 저장 목록 한 페이지. 목록 페이지(Server Component)와 "더 보기" 액션이 같은 형식을 쓴다.
// Client Component로 넘기므로 날짜는 화면에 쓸 문자열로 바꿔 둔다.

export const SAVED_PAGE_SIZE = 20;

export type SavedListItem = {
  id: string;
  addressDisplay: string;
  headline: string; // "위험 신호 N개"
  dataBaseDate: string; // YYYY-MM-DD
  savedAt: string; // YYYY-MM-DD, 한국 시간
};

export type SavedPage = { items: SavedListItem[]; nextCursor: string | null };

export function toSavedPage(page: { items: SavedSummary[]; nextCursor: string | null }): SavedPage {
  return {
    items: page.items.map((item) => ({
      id: item.id,
      addressDisplay: item.addressDisplay,
      headline: headline(item.signalCount),
      dataBaseDate: formatIsoDate(item.dataBaseDate),
      savedAt: formatSeoulDate(item.createdAt),
    })),
    nextCursor: page.nextCursor,
  };
}
