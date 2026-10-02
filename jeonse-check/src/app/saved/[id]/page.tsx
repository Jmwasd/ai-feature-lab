import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/Button";
import { AuthTopNav } from "@/features/auth/AuthTopNav";
import { deserializeJudgmentView, SERIALIZED_VIEW_VERSION, type SerializedJudgmentView } from "@/features/judgment/serialize";
import { ResultView } from "@/features/judgment/ui/ResultView";
import type { JudgmentView } from "@/features/judgment/ui/types";
import { auth } from "@/server/auth";
import { createPrismaSavedResultRepository } from "@/server/saved/prisma-repository";
import { formatIsoDate, formatSeoulDate } from "@/utils/format";
import { deleteResultAction } from "../_actions/delete-result";
import { DeleteResultButton } from "./_components/DeleteResultButton";

type SavedDetailPageProps = { params: Promise<{ id: string }> };

// 저장한 결과 상세. 저장 당시의 판정과 기준일을 그대로 보여 주고, 현재 정책값으로 다시 계산하지 않는다.
export default async function SavedDetailPage({ params }: SavedDetailPageProps) {
  const { id } = await params;
  // proxy가 이미 막더라도 페이지에서 다시 확인한다(ADR-002).
  const session = await auth();
  if (!session) redirect(`/?callbackUrl=/saved/${encodeURIComponent(id)}`);

  // 없는 id와 남의 id를 구분하지 않는다(존재 여부를 드러내지 않는다).
  const saved = await createPrismaSavedResultRepository().getForUser(session.user.id, id);
  if (!saved) notFound();

  const view = readSavedView(saved.result);
  const savedAt = formatSeoulDate(saved.createdAt);
  const dataBaseDate = formatIsoDate(saved.dataBaseDate);

  return (
    <>
      <AuthTopNav links={[]} />
      <main>
        <div className="mx-auto flex w-full max-w-editorial flex-col items-start gap-base px-gutter pt-section">
          <Button href="/saved" variant="tertiary-text">
            저장 목록으로
          </Button>
          <h1 className="text-display-xl text-ink">저장한 결과</h1>
          <p className="w-full rounded-card bg-surface-soft p-lg text-body-md tabular-nums text-body">
            {savedAt}에 저장한 결과예요. 데이터 기준일은 {dataBaseDate}이에요. 지금 다시 조회하면 달라질 수 있어요
          </p>
          <div className="flex flex-wrap items-start gap-sm">
            <Button href={`/check?from=${encodeURIComponent(saved.id)}`} variant="secondary">
              같은 조건으로 다시 조회
            </Button>
            <DeleteResultButton id={saved.id} deleteResult={deleteResultAction} />
          </div>
        </div>
        {view ? (
          <ResultView view={view} />
        ) : (
          <div className="mx-auto w-full max-w-editorial px-gutter py-section">
            <p role="status" className="rounded-card bg-surface-soft p-lg text-title-md text-ink">
              이전 형식의 결과라 표시할 수 없어요
            </p>
          </div>
        )}
      </main>
    </>
  );
}

// 지금 읽을 수 있는 형식(version)만 역직렬화한다. 모르는 버전이나 깨진 값은 추측해서 변환하지 않고 null이다.
function readSavedView(result: unknown): JudgmentView | null {
  if (typeof result !== "object" || result === null || (result as { version?: unknown }).version !== SERIALIZED_VIEW_VERSION) {
    return null;
  }
  try {
    return deserializeJudgmentView(result as SerializedJudgmentView);
  } catch {
    return null;
  }
}
