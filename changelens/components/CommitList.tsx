"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CommitCard } from "@/components/ui/CommitCard";
import { formatCount } from "@/lib/format";
import type { CommitPage, CommitSummary } from "@/types/git";

export function CommitList({ initialCommits, totalCommits }: {
  initialCommits: CommitSummary[];
  totalCommits: number;
}) {
  const [commits, setCommits] = useState(initialCommits);
  const [nextSkip, setNextSkip] = useState<number | null>(initialCommits.length < 50 ? null : initialCommits.length);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  async function loadMore() {
    if (pending.current || nextSkip === null) return;
    pending.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/commits?skip=${nextSkip}`);
      if (!response.ok) {
        setError(response.status === 401
          ? "세션이 만료되었다. 새로고침 후 다시 로그인한다."
          : "커밋을 불러오지 못했다. 잠시 후 다시 시도한다.");
        return;
      }
      const page: CommitPage = await response.json();
      setCommits((current) => {
        const existing = new Set(current.map((commit) => commit.sha));
        return [...current, ...page.commits.filter((commit) => !existing.has(commit.sha))];
      });
      setNextSkip(page.nextSkip);
    } catch {
      setError("연결을 확인하고 다시 시도한다.");
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  return (
    <section className="mt-12" aria-labelledby="commits-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="commits-heading" className="text-lg font-semibold leading-[1.4] text-ink">커밋</h2>
        <p aria-live="polite" className="font-mono text-xs leading-[1.5] text-muted">
          {formatCount(commits.length)} / {formatCount(totalCommits)} · 최신순
        </p>
      </div>
      <ul className="mt-4 space-y-2" aria-busy={loading}>
        {commits.map((commit) => <li key={commit.sha}><CommitCard commit={commit} /></li>)}
      </ul>
      {nextSkip !== null && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={loadMore} disabled={loading}>
            {loading ? "불러오는 중" : <><span className="font-mono">50</span>개 더 보기</>}
          </Button>
          {error && <p role="alert" className="text-sm leading-[1.6] text-body-dim">{error}</p>}
        </div>
      )}
    </section>
  );
}
