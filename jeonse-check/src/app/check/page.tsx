import { redirect } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { AuthNavAction } from "@/features/auth/AuthNavAction";
import { auth } from "@/server/auth";
import { runCheckAction } from "./_actions/run-check";
import { searchAddressAction } from "./_actions/search-address";
import { CheckFlow } from "./_components/CheckFlow";

const NAV_LINKS = [
  { href: "/#try", label: "계산해 보기" },
  { href: "/#cases", label: "사례" },
  { href: "/#flow", label: "이용 방법" },
  { href: "/#sources", label: "데이터 출처" },
];

// 조회 화면. 흐름은 CheckFlow(Client Component)가 맡고, 서버 호출은 Server Action을 props로 넘겨서만 한다.
export default async function CheckPage() {
  // proxy가 이미 막더라도 페이지에서 다시 확인한다(ADR-002).
  const session = await auth();
  if (!session) redirect("/?callbackUrl=/check");

  const userName = session.user.name ?? session.user.email ?? "사용자";

  return (
    <>
      <TopNav links={NAV_LINKS} action={<AuthNavAction />} />
      <main>
        <p className="mx-auto max-w-editorial px-gutter pt-lg text-caption text-muted">{userName}님으로 로그인했어요</p>
        <CheckFlow searchAddress={searchAddressAction} runCheck={runCheckAction} />
      </main>
    </>
  );
}
