"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/Button";
import type { LoadMoreSavedResult } from "../_actions/list-saved";
import type { SavedPage } from "../_lib/saved-list";

// 저장 목록과 "더 보기". 첫 페이지는 서버가 그려 넘기고, 다음 페이지는 액션으로 받아 뒤에 붙인다.
// 행은 신호 행 패턴(UI_GUIDE §4): 상단 1px hairline-soft, 제목 text-title-md, 보조 text-body-sm.

const LOAD_ERROR_COPY = {
  unauthorized: "로그인이 끝났어요. 다시 로그인한 뒤 목록을 열어 주세요",
  failed: "목록을 더 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요",
} as const;

type SavedListProps = {
  initial: SavedPage;
  loadMore: (cursor: string) => Promise<LoadMoreSavedResult>;
};

export function SavedList({ initial, loadMore }: SavedListProps) {
  const [items, setItems] = useState(initial.items);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<keyof typeof LOAD_ERROR_COPY | null>(null);
  // 비활성화가 화면에 반영되기 전에 연달아 눌러도 한 번만 호출한다.
  const inFlight = useRef(false);

  async function showMore() {
    if (inFlight.current || nextCursor === null) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    const result = await loadMoreSafely(loadMore, nextCursor);
    inFlight.current = false;
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setItems((prev) => [...prev, ...result.page.items]);
    setNextCursor(result.page.nextCursor);
  }

  return (
    <div className="flex flex-col gap-lg">
      <ul aria-label="저장한 결과" className="flex flex-col border-b border-hairline-soft">
        {items.map((item) => (
          <li key={item.id} className="border-t border-hairline-soft">
            <Link
              href={`/saved/${item.id}`}
              className="flex flex-col gap-xs py-base transition-colors hover:bg-surface-soft hover:no-underline"
            >
              <span className="text-title-md text-ink">{item.addressDisplay}</span>
              <span className="text-body-md tabular-nums text-ink">{item.headline}</span>
              <span className="text-caption-sm tabular-nums text-muted">
                데이터 기준일 {item.dataBaseDate} · 저장일 {item.savedAt}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {nextCursor !== null ? (
        <div className="flex flex-col items-center gap-sm">
          <Button variant="secondary" onClick={() => void showMore()} disabled={loading} aria-busy={loading}>
            더 보기
          </Button>
          {error !== null ? (
            <p role="alert" className="text-center text-body-sm text-error-text">
              {LOAD_ERROR_COPY[error]}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// 호출 예외(네트워크 등)는 원인을 보이지 않고 failed로 둔다.
async function loadMoreSafely(loadMore: SavedListProps["loadMore"], cursor: string): Promise<LoadMoreSavedResult> {
  try {
    return await loadMore(cursor);
  } catch {
    return { ok: false, error: "failed" };
  }
}
