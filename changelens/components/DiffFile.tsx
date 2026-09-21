"use client"; // ui-check-ignore: DiffBlock이 줄바꿈 방지와 가로 스크롤을 담당한다.

import { useId, useState } from "react";
import { DiffBlock } from "@/components/ui/DiffBlock";
import { hunkRange, showCommand, startsCollapsed } from "@/lib/diff-view";
import { shortSha } from "@/lib/format";
import type { FileDiff } from "@/types/git";

export function DiffFile({ file, sha }: { file: FileDiff; sha: string }) {
  const [expanded, setExpanded] = useState(() => !startsCollapsed(file));
  const contentId = useId();

  return (
    <DiffBlock
      file={file}
      expanded={expanded}
      onToggle={() => setExpanded((current) => !current)}
      contentId={contentId}
      range={hunkRange(file)}
      command={showCommand(shortSha(sha), file.path)}
    />
  );
}
