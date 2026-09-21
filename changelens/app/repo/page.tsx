import { cookies } from "next/headers";
import { CommitList } from "@/components/CommitList";
import { LogoutButton } from "@/components/LogoutButton";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Logo } from "@/components/ui/Logo";
import { MetricCard } from "@/components/ui/MetricCard";
import { TopBar } from "@/components/ui/TopBar";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { formatContributors, formatCount, formatDate, formatPeriod, formatSigned, shortSha } from "@/lib/format";
import { GitError, getRepoMetrics, getRepoStatus, listCommits, resolveRepoPath } from "@/lib/git";

export const runtime = "nodejs";

export default async function RepoPage() {
  const cookieStore = await cookies();
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value, secret);
  const repoPath = resolveRepoPath();

  try {
    const status = await getRepoStatus(repoPath);
    if (status.kind === "git-missing") {
      return (
        <EmptyState
          status="git · 설치 필요"
          title="git을 설치한 뒤 다시 실행한다"
          description={<>git을 설치하고 터미널에서 <code className="font-mono">git --version</code>이 실행되는지 확인한다.</>}
          action={<ButtonLink href="/repo">다시 확인</ButtonLink>}
        />
      );
    }
    if (status.kind === "not-repo") {
      return (
        <EmptyState
          status="git · 저장소 없음"
          title="여긴 git 저장소가 아니다"
          description={<>
            <span className="block break-all font-mono text-[13px]">{status.path}</span>
            <span className="mt-3 block">저장소 경로를 지정해 다시 실행한다.</span>
            <code className="mt-3 block break-words font-mono text-[13px]">node bin/changelens.mjs &lt;저장소경로&gt;</code>
          </>}
          action={<ButtonLink href="/repo">다시 확인</ButtonLink>}
        />
      );
    }
    if (status.kind === "empty") {
      return (
        <EmptyState
          status="0 · 커밋 없음"
          title="아직 커밋이 없다"
          description="저장소에서 첫 커밋을 만든 뒤 다시 확인한다."
          action={<ButtonLink href="/repo">다시 확인</ButtonLink>}
        />
      );
    }

    const [metrics, commits] = await Promise.all([getRepoMetrics(repoPath), listCommits(repoPath)]);
    const headLabel = `HEAD · ${metrics.branch ?? shortSha(metrics.head)}`;

    return (
      <>
        <TopBar surface>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Logo markOnly />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="w-full truncate font-mono text-[13px] text-body sm:w-auto" title={status.path}>{status.path}</span>
              <Badge className="max-w-full shrink-0 sm:max-w-[260px]"><span className="truncate">{headLabel}</span></Badge>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span className="max-w-32 truncate font-mono text-xs text-muted sm:max-w-64" title={session?.email}>{session?.email}</span>
            <LogoutButton />
          </div>
        </TopBar>
        <main className="mx-auto max-w-[1080px] px-6 pb-24 pt-8">
          <h1 className="sr-only">저장소 변경 이력</h1>
          <section aria-label="저장소 지표" className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
            <MetricCard label="전체 커밋" value={formatCount(metrics.totalCommits)} detail={headLabel} />
            <MetricCard
              label="기간"
              value={formatPeriod(metrics.firstDate, metrics.lastDate)}
              detail={<><span className="inline-block">{formatDate(metrics.firstDate)}</span> → <span className="inline-block">{formatDate(metrics.lastDate)}</span></>}
            />
            <MetricCard label="추가 / 삭제 줄" value={formatSigned(metrics.additions, "+")} detail={<span className="text-del">{formatSigned(metrics.deletions, "−")}</span>} />
            <MetricCard label="기여자" value={formatCount(metrics.contributors)} detail={formatContributors(metrics.topContributor, metrics.contributors)} />
          </section>
          <CommitList initialCommits={commits} totalCommits={metrics.totalCommits} />
        </main>
      </>
    );
  } catch (error) {
    if (!(error instanceof GitError)) throw error;
    return (
      <EmptyState
        status="git · 읽기 실패"
        title="저장소를 확인하고 다시 시도한다"
        description={<span className="break-all font-mono text-[13px]">{error.message}</span>}
        action={<ButtonLink href="/repo">다시 시도</ButtonLink>}
      />
    );
  }
}
