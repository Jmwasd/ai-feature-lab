import { formatSigned } from "@/lib/format";
import type { FileStat } from "@/types/git";
import { Card } from "./Card";

export function FileList({ files }: { files: FileStat[] }) {
  return (
    <section className="mt-8" aria-labelledby="files-heading">
      <Card padded={false} className="overflow-hidden">
        <h2 id="files-heading" className="border-b border-hairline px-5 py-3 text-[15px] font-semibold leading-[1.4] text-body">바뀐 파일</h2>
        {files.length === 0 ? (
          <p className="p-5 text-sm leading-[1.6] text-body-dim">바뀐 파일이 없다.</p>
        ) : (
          <ul>
            {files.map((file) => {
              const path = file.oldPath ? `${file.oldPath} → ${file.path}` : file.path;
              return (
                <li key={file.path} className="flex items-center justify-between gap-4 border-b border-hairline-soft px-5 py-3 font-mono text-[13px] last:border-b-0">
                  <span className="min-w-0 truncate text-body" title={path}>{path}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {file.additions === null || file.deletions === null ? (
                      <span className="text-muted">바이너리</span>
                    ) : (
                      <>
                        <span className="text-add">{formatSigned(file.additions, "+")}</span>
                        <span className="text-del">{formatSigned(file.deletions, "−")}</span>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
