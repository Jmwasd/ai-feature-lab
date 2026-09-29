import { redirect } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { AuthNavAction } from "@/features/auth/AuthNavAction";
import { auth } from "@/server/auth";

const NAV_LINKS = [
  { href: "/#try", label: "계산해 보기" },
  { href: "/#cases", label: "사례" },
  { href: "/#flow", label: "이용 방법" },
  { href: "/#sources", label: "데이터 출처" },
];

// 조회 화면 자리다. 조회 폼과 결과는 phase 2에서 만든다.
export default async function CheckPage() {
  // proxy가 이미 막더라도 페이지에서 다시 확인한다(ADR-002).
  const session = await auth();
  if (!session) redirect("/?callbackUrl=/check");

  const userName = session.user.name ?? session.user.email ?? "사용자";

  return (
    <>
      <TopNav links={NAV_LINKS} action={<AuthNavAction />} />
      <main className="px-gutter py-section">
        <div className="mx-auto flex max-w-editorial flex-col gap-md">
          <p className="text-caption text-muted">{userName}님으로 로그인했어요</p>
          <h1 className="text-display-xl text-ink">주소와 보증금을 입력해 주세요</h1>
          <p className="text-body-md text-body">조회 화면은 준비 중이에요</p>
        </div>
      </main>
    </>
  );
}
