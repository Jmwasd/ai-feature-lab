import { Button } from "@/components/Button";
import { signInWithGoogle } from "@/features/auth/actions";
import { safeCallbackUrl } from "@/features/auth/callback-url";
import { auth } from "@/server/auth";

type LoginNoticeProps = { callbackUrl: string };

// proxy가 보호 경로에서 /?callbackUrl=로 보냈을 때 히어로 앞에 둔다.
// 히어로 primary CTA와 합쳐 레드 CTA가 뷰포트당 2개를 넘지 않는다(UI_GUIDE §1).
export async function LoginNotice({ callbackUrl }: LoginNoticeProps) {
  if (await auth()) return null;

  return (
    <div role="status" className="border-b border-hairline-soft px-gutter py-lg">
      <div className="mx-auto flex max-w-editorial flex-wrap items-center justify-between gap-md">
        <div className="flex flex-col gap-xs">
          <p className="text-title-md text-ink">로그인이 필요해요</p>
          <p className="text-body-sm text-muted">Google 계정으로 로그인하면 조회 화면으로 이어서 갈 수 있어요.</p>
        </div>
        <form action={signInWithGoogle}>
          <input type="hidden" name="callbackUrl" value={safeCallbackUrl(callbackUrl)} />
          <Button type="submit">Google로 로그인</Button>
        </form>
      </div>
    </div>
  );
}
