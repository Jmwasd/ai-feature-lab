import { Button } from "@/components/Button";
import { auth } from "@/server/auth";
import { signInWithGoogle, signOutAction } from "./actions";

// TopNav(shared)가 auth를 모르도록 세션에 맞는 오른쪽 영역을 만들어 action으로 넘긴다.
export async function AuthNavAction() {
  const session = await auth();

  if (!session) {
    // callbackUrl을 보내지 않으면 로그인 뒤 기본 경로(/check)로 간다.
    return (
      <form action={signInWithGoogle}>
        <Button type="submit" variant="secondary">
          로그인
        </Button>
      </form>
    );
  }

  return (
    <>
      <Button href="/check" variant="secondary">
        내 조회
      </Button>
      <Button href="/saved" variant="tertiary-text">
        저장 목록
      </Button>
      <form action={signOutAction}>
        <Button type="submit" variant="tertiary-text">
          로그아웃
        </Button>
      </form>
    </>
  );
}
