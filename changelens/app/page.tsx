import { GoogleSignIn } from "@/components/GoogleSignIn";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Logo } from "@/components/ui/Logo";
import { TopBar } from "@/components/ui/TopBar";
import { pickLandingView } from "@/lib/landing";

export default async function Home({ searchParams }: {
  searchParams: Promise<{ next?: string | string[]; login?: string | string[] }>;
}) {
  const view = pickLandingView(await searchParams);

  if (view.kind === "blocked") {
    return (
      <EmptyState
        status="401 · 세션 없음"
        title="로그인해야 저장소를 볼 수 있습니다"
        description={<><span className="font-mono">/repo</span> 는 세션 쿠키가 있어야 열립니다. 구글 계정으로 로그인하면 원래 보려던 화면으로 돌아옵니다.</>}
        action={<ButtonLink variant="primary" href={`/?login&next=${encodeURIComponent(view.next)}`}>로그인</ButtonLink>}
      />
    );
  }

  if (view.kind === "login") {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 py-12">
        <Card className="w-full max-w-[400px] text-center">
          <Logo />
          <h1 className="mt-6 text-2xl font-semibold leading-[1.3] text-ink">계정으로 계속하기</h1>
          <p className="mt-2 text-sm leading-[1.6] text-body-dim">ID 토큰을 서버가 검증한 뒤 세션 쿠키를 발급합니다.</p>
          <div className="mt-6">
            <GoogleSignIn clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID} next={view.next} />
          </div>
          <p className="mt-4 font-mono text-xs leading-[1.5] text-muted">세션은 이 브라우저에만 저장됩니다.</p>
        </Card>
      </main>
    );
  }

  return (
    <>
      <TopBar>
        <Logo />
        <ButtonLink variant="small" href="/?login">로그인</ButtonLink>
      </TopBar>
      <main className="mx-auto max-w-[1080px] px-6">
        <section className="py-24">
          <p className="font-mono text-xs leading-[1.5] tracking-[0.5px] text-muted">LOCAL GIT · READ ONLY</p>
          <h1 className="mt-4 max-w-[760px] text-5xl font-bold leading-[1.1] tracking-[-0.5px] text-ink">커밋 메시지가 말하지 않는 것까지 읽는다</h1>
          <p className="mt-5 max-w-[560px] text-base leading-[1.6] text-body-dim">로컬 저장소의 변경 이력을 한 화면에 펼치고, 커밋마다 실제로 무엇을 어떻게 바꿨는지 diff 단위로 보여준다.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink variant="primary" href="/?login">구글로 시작하기</ButtonLink>
            <code className="rounded-md border border-hairline bg-surface px-4 py-3 font-mono text-[13px] text-muted">node bin/changelens.mjs</code>
          </div>
        </section>
        <section aria-label="주요 기능" className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 pb-24">
          <Card>
            <p className="font-mono text-xs text-muted">01</p>
            <h2 className="mt-3 text-lg font-semibold leading-[1.4] text-ink">저장소 전체를 한 눈에</h2>
            <p className="mt-2 text-sm leading-[1.6] text-body-dim">현재 브랜치의 커밋을 최신순으로 읽고, 바뀐 파일과 추가·삭제 줄 수를 함께 살핀다.</p>
          </Card>
          <Card>
            <p className="font-mono text-xs text-muted">02</p>
            <h2 className="mt-3 text-lg font-semibold leading-[1.4] text-ink">지표 <span className="font-mono">4</span>종</h2>
            <p className="mt-2 text-sm leading-[1.6] text-body-dim">전체 커밋 수, 변경 기간, 추가·삭제 줄 수, 기여자 수로 저장소의 이력을 파악한다.</p>
          </Card>
          <Card>
            <p className="font-mono text-xs text-muted">03</p>
            <h2 className="mt-3 text-lg font-semibold leading-[1.4] text-ink">diff를 읽은 요약</h2>
            <p className="mt-2 text-sm leading-[1.6] text-body-dim">Claude가 diff를 읽고 커밋이 실제로 한 일을 정리한다. 파일별 diff로 변경 내용을 확인한다.</p>
          </Card>
        </section>
      </main>
      <footer className="border-t border-hairline">
        <p className="mx-auto max-w-[1080px] p-6 font-mono text-xs leading-[1.5] text-muted">changelens · 내 컴퓨터에서만 돕니다. 저장소 내용은 어디에도 올라가지 않습니다.</p>
      </footer>
    </>
  );
}
