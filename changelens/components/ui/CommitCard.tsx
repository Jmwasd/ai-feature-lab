import Link from "next/link";
import { formatCount, formatDateTime, formatSigned, shortSha } from "@/lib/format";
import type { CommitSummary } from "@/types/git";

export function CommitCard({ commit }: { commit: CommitSummary }) {
  const hasLineChanges = commit.additions !== 0 || commit.deletions !== 0;

  return (
    <Link
      href={`/repo/${commit.sha}`}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-hairline bg-surface px-5 py-4"
    >
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-semibold leading-[1.4] text-body" title={commit.subject}>{commit.subject}</h3>
        <p className="mt-1 flex flex-wrap gap-x-1 font-mono text-xs leading-[1.5] text-muted">
          <span>{shortSha(commit.sha)} ·</span>
          <span className="break-all">{commit.authorName} ·</span>
          <span><time dateTime={commit.authorDate}>{formatDateTime(commit.authorDate)}</time> ·</span>
          <span>{formatCount(commit.files)} files</span>
        </p>
      </div>
      <div className="flex items-center gap-3 font-mono text-[13px]">
        {hasLineChanges ? (
          <>
            <span className="text-add">{formatSigned(commit.additions, "+")}</span>
            <span className="text-del">{formatSigned(commit.deletions, "−")}</span>
          </>
        ) : (
          <span className="text-xs text-muted" title="바이너리·이름 변경·빈 커밋 등 텍스트 줄 수가 변하지 않은 커밋이다.">줄 변경 없음</span>
        )}
        <span aria-hidden="true" className="text-muted">›</span>
      </div>
    </Link>
  );
}
