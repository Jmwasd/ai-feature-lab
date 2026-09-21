import type { DiffLine, FileDiff } from "@/types/git";
import { Card } from "./Card";

const lineColors: Record<DiffLine["kind"], string> = {
  add: "bg-diff-add-bg text-diff-add-fg",
  del: "bg-diff-del-bg text-diff-del-fg",
  ctx: "text-muted",
};

export function DiffBlock({ file, expanded, onToggle, contentId, range, command }: {
  file: FileDiff;
  expanded: boolean;
  onToggle: () => void;
  contentId: string;
  range: string | null;
  command: string;
}) {
  const path = file.oldPath ? `${file.oldPath} → ${file.path}` : file.path;

  return (
    <Card padded={false} className="min-w-0 overflow-hidden">
      <h3>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          aria-label={`${path} diff ${expanded ? "접기" : "펼치기"}`}
          onClick={onToggle}
          className="flex min-h-10 w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 rounded-md px-5 py-3 text-left focus-visible:-outline-offset-2"
        >
          <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-body" title={path}>{path}</span>
          <span className="font-mono text-xs text-muted">{expanded ? "접기" : "펼치기"}</span>
          {range && <span className="w-full font-mono text-xs text-muted sm:w-auto">{range}</span>}
        </button>
      </h3>
      <div id={contentId} hidden={!expanded}>
        {expanded && (
          <div className="border-t border-hairline">
            {file.binary ? (
              <p className="p-5 text-sm leading-[1.6] text-body-dim">바이너리 파일이라 텍스트 diff를 표시하지 않는다.</p>
            ) : file.omitted ? (
              <div className="p-5">
                <p className="text-sm leading-[1.6] text-body-dim">파일 diff가 <span className="font-mono">256KB</span>를 넘어 생략했다. 저장소 터미널에서 다음 명령으로 확인한다.</p>
                <pre className="mt-3 overflow-x-auto whitespace-pre font-mono text-[13px] leading-[1.7] text-body" tabIndex={0}><code>{command}</code></pre>
              </div>
            ) : file.hunks.length === 0 ? (
              <p className="p-5 text-sm leading-[1.6] text-body-dim">텍스트 줄 변경이 없다.</p>
            ) : (
              <div className="overflow-x-auto" role="region" aria-label={`${path} diff`} tabIndex={0}>
                <div className="w-max min-w-full font-mono text-[13px] leading-[1.7]">
                  {file.hunks.map((hunk, hunkIndex) => (
                    <div key={hunkIndex}>
                      {hunkIndex > 0 && <div className="whitespace-pre px-5 text-muted">{hunk.header}</div>}
                      {hunk.lines.map((line, lineIndex) => (
                        <div key={lineIndex} className={`whitespace-pre px-5 ${lineColors[line.kind]}`}>{line.text}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
