import { notFound } from "next/navigation";
import { DiffFile } from "@/components/DiffFile";
import { SummaryCard } from "@/components/SummaryCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileList } from "@/components/ui/FileList";
import { TopBar } from "@/components/ui/TopBar";
import { formatCount, formatDateTime, formatSigned, shortSha } from "@/lib/format";
import { CommitNotFoundError, GitError, GitNotInstalledError, getCommitDetail, isValidSha, resolveRepoPath } from "@/lib/git";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CommitDetailPage({ params }: { params: Promise<{ sha: string }> }) {
  const { sha } = await params;
  if (!isValidSha(sha)) notFound();

  try {
    const commit = await getCommitDetail(resolveRepoPath(), sha);

    return (
      <>
        <TopBar surface>
          <div className="flex min-w-0 items-center gap-3">
            <ButtonLink href="/repo" variant="small">← 커밋 목록</ButtonLink>
            <span className="font-mono text-[13px] text-muted">{shortSha(commit.sha)}</span>
          </div>
        </TopBar>
        <main className="mx-auto max-w-[1080px] px-6 pb-24 pt-8">
          <h1 className="break-words text-2xl font-semibold leading-[1.3] text-ink">{commit.subject}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-xs leading-[1.5] text-muted">
            <span className="break-all">{commit.authorName}</span>
            <time dateTime={commit.authorDate}>{formatDateTime(commit.authorDate)}</time>
            <span>{formatCount(commit.files.length)} files</span>
            <span className="text-add">{formatSigned(commit.additions, "+")}</span>
            <span className="text-del">{formatSigned(commit.deletions, "−")}</span>
          </div>
          {process.env.ANTHROPIC_API_KEY && <SummaryCard key={commit.sha} sha={commit.sha} />}
          <FileList files={commit.files} />
          <section className="mt-8 space-y-4" aria-label="파일별 diff">
            {commit.diffs.map((file) => <DiffFile key={`${commit.sha}:${file.path}`} file={file} sha={commit.sha} />)}
          </section>
        </main>
      </>
    );
  } catch (error) {
    if (error instanceof CommitNotFoundError) notFound();
    if (!(error instanceof GitError) && !(error instanceof GitNotInstalledError)) throw error;
    return (
      <EmptyState
        status="git · 읽기 실패"
        title="저장소를 확인하고 다시 시도한다"
        description={error instanceof GitNotInstalledError
          ? <>git을 설치하고 터미널에서 <code className="font-mono">git --version</code>이 실행되는지 확인한다.</>
          : <span className="break-all font-mono text-[13px]">{error.message}</span>}
        action={<ButtonLink href="/repo">← 커밋 목록</ButtonLink>}
      />
    );
  }
}
