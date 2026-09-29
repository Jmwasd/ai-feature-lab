import { redirect } from "next/navigation";
import { Button } from "@/components/Button";
import { TopNav } from "@/components/TopNav";
import { AuthNavAction } from "@/features/auth/AuthNavAction";
import { DISCLAIMER, SOURCES } from "@/features/judgment/copy";
import { auth } from "@/server/auth";
import { createPrismaSavedResultRepository } from "@/server/saved/prisma-repository";
import { loadMoreSavedAction } from "./_actions/list-saved";
import { SavedList } from "./_components/SavedList";
import { SAVED_PAGE_SIZE, toSavedPage } from "./_lib/saved-list";

// 저장 목록. 최신순 첫 페이지를 서버에서 그리고, 다음 페이지는 SavedList가 "더 보기"로 받는다.
export default async function SavedPage() {
  // proxy가 이미 막더라도 페이지에서 다시 확인한다(ADR-002).
  const session = await auth();
  if (!session) redirect("/?callbackUrl=/saved");

  const page = toSavedPage(
    await createPrismaSavedResultRepository().listByUser(session.user.id, { limit: SAVED_PAGE_SIZE }),
  );

  return (
    <>
      <TopNav links={[]} action={<AuthNavAction />} />
      <main className="mx-auto flex w-full max-w-editorial flex-col gap-xl px-gutter py-section">
        <h1 className="text-display-xl text-ink">저장 목록</h1>
        {page.items.length === 0 ? (
          <div className="flex flex-col items-start gap-base">
            <p className="text-body-md text-body">저장한 결과가 없어요</p>
            <Button href="/check">조회하러 가기</Button>
          </div>
        ) : (
          <>
            <SavedList initial={page} loadMore={loadMoreSavedAction} />
            {/* 목록에도 "위험 신호 N개"가 보이므로 출처와 면책 문구를 함께 둔다(CLAUDE.md CRITICAL). */}
            <footer className="flex flex-col gap-sm">
              <p className="text-caption-sm text-muted">출처 {SOURCES.join(" · ")}</p>
              <p className="text-body-sm text-body">{DISCLAIMER}</p>
            </footer>
          </>
        )}
      </main>
    </>
  );
}
