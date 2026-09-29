import { Button } from "@/components/Button";
import { auth } from "@/server/auth";
import { signOutAction } from "./actions";

// TopNav(shared)가 auth를 모르도록 세션에 맞는 오른쪽 영역을 만들어 action으로 넘긴다.
export async function AuthNavAction() {
  const session = await auth();

  if (!session) {
    return (
      <Button href="/check" variant="secondary">
        지금 확인하기
      </Button>
    );
  }

  return (
    <>
      <Button href="/check" variant="secondary">
        내 조회
      </Button>
      <form action={signOutAction}>
        <Button type="submit" variant="tertiary-text">
          로그아웃
        </Button>
      </form>
    </>
  );
}
