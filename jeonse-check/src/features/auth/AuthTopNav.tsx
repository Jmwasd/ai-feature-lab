import { Bookmark, MessagesSquare, Search } from "lucide-react";
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

// 개발 대화 기록. 로그인과 상관없이 모든 페이지의 오른쪽 계정 메뉴 맨 앞에 둔다.
const CHAT_LOG_LINK = { href: "/chat-log", label: "채팅 로그", icon: <MessagesSquare {...NAV_ICON} /> };

type AuthTopNavProps = Pick<ComponentProps<typeof TopNav>, "links" | "overlay">;

// TopNav(shared)가 auth를 모르도록 세션에 맞는 오른쪽 영역을 여기서 조합한다.
// 로그인·로그아웃은 같은 자리의 secondary 버튼이다(UI_GUIDE §4 TopNav).
export async function AuthTopNav({ links, overlay }: AuthTopNavProps) {
  const session = await auth();
  if (!session) {
    return (
      <TopNav links={links} overlay={overlay} accountLinks={[CHAT_LOG_LINK]} action={<LoginDialog signIn={signInWithGoogle} />} />
    );
  }

  return (
    <TopNav
      links={links}
      overlay={overlay}
      accountLinks={[CHAT_LOG_LINK, ...ACCOUNT_LINKS]}
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
