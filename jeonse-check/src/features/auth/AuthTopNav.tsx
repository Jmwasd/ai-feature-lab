import { Bookmark, Search } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/Button";
import { TopNav } from "@/components/TopNav";
import { auth } from "@/server/auth";
import { signInWithGoogle, signOutAction } from "./actions";
import { LoginDialog } from "./LoginDialog";

const NAV_ICON = { "aria-hidden": true, size: 16 } as const;

const ACCOUNT_LINKS = [
  { href: "/check", label: "내 조회", icon: <Search {...NAV_ICON} /> },
  { href: "/saved", label: "저장 목록", icon: <Bookmark {...NAV_ICON} /> },
];

type AuthTopNavProps = Pick<ComponentProps<typeof TopNav>, "links">;

// TopNav(shared)가 auth를 모르도록 세션에 맞는 오른쪽 영역을 여기서 조합한다.
// 로그인·로그아웃은 같은 자리의 secondary 버튼이다(UI_GUIDE §4 TopNav).
export async function AuthTopNav({ links }: AuthTopNavProps) {
  const session = await auth();

  if (!session) {
    return <TopNav links={links} action={<LoginDialog signIn={signInWithGoogle} />} />;
  }

  return (
    <TopNav
      links={links}
      accountLinks={ACCOUNT_LINKS}
      accountAction={
        <form action={signOutAction}>
          <Button type="submit" variant="secondary">
            로그아웃
          </Button>
        </form>
      }
    />
  );
}
