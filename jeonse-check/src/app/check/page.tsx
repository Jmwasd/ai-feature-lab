import { redirect } from "next/navigation";
import { AuthTopNav } from "@/features/auth/AuthTopNav";
import { auth } from "@/server/auth";
import { createPrismaSavedResultRepository } from "@/server/saved/prisma-repository";
import { runCheckAction } from "./_actions/run-check";
import { saveResultAction } from "./_actions/save-result";
import { searchAddressAction } from "./_actions/search-address";
import { CheckFlow } from "./_components/CheckFlow";
import { type CheckPrefill, readSavedPrefill } from "./_lib/saved-prefill";

const NAV_LINKS = [
  { href: "/#try", label: "계산해 보기" },
  { href: "/#cases", label: "사례" },
  { href: "/#flow", label: "이용 방법" },
  { href: "/#sources", label: "데이터 출처" },
];

type CheckPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// 조회 화면. 흐름은 CheckFlow(Client Component)가 맡고, 서버 호출은 Server Action을 props로 넘겨서만 한다.
// ?from=<저장 id>이면 그 저장 결과의 입력으로 폼을 미리 채운다. URL에는 id만 싣고 입력 값은 싣지 않는다(개인 정보).
export default async function CheckPage({ searchParams }: CheckPageProps) {
  // proxy가 이미 막더라도 페이지에서 다시 확인한다(ADR-002).
  const session = await auth();
  if (!session) redirect("/?callbackUrl=/check");

  const userName = session.user.name ?? session.user.email ?? "사용자";
  const { from } = await searchParams;
  const prefill = typeof from === "string" ? await loadPrefill(session.user.id, from) : null;

  return (
    <>
      <AuthTopNav links={NAV_LINKS} />
      <main>
        <p className="mx-auto max-w-editorial px-gutter pt-lg text-caption text-muted">{userName}님으로 로그인했어요</p>
        <CheckFlow searchAddress={searchAddressAction} runCheck={runCheckAction} saveResult={saveResultAction} prefill={prefill} />
      </main>
    </>
  );
}

// 남의 id·없는 id는 구분하지 않고 빈 폼으로 시작한다.
async function loadPrefill(userId: string, id: string): Promise<CheckPrefill | null> {
  const saved = await createPrismaSavedResultRepository().getForUser(userId, id);
  return saved ? readSavedPrefill(saved.input) : null;
}
