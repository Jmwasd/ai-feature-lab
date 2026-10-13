"use client";

import { useState } from "react";

/**
 * 한 칸씩 열어 가는 입력 폼의 단계 상태. steps[i]는 i번째 칸 값이 유효한지다.
 * 앞에서부터 유효한 칸 수만큼 다음 칸이 열리고, 한 번 열린 칸은 앞 칸을 고쳐도 닫지 않는다(입력이 사라지지 않게).
 * prefilled면(다시 조회 등) 처음부터 모든 칸을 보이고 나타나는 연출을 하지 않는다.
 */
export function useProgressiveStages<S extends string>(stages: readonly S[], steps: boolean[], prefilled: boolean) {
  const allStages = stages.length - 1;
  const [initialStage] = useState(() => (prefilled ? allStages : 0));
  const reachable = countValid(steps);
  const [openedStage, setOpenedStage] = useState(initialStage);
  if (reachable > openedStage) setOpenedStage(reachable);
  const visibleStage = Math.max(openedStage, reachable);

  return {
    /** 지금 값이 모두 유효하다. 다음·확인 버튼을 이때만 보인다. */
    complete: reachable === allStages,
    isOpen: (stage: S) => stages.indexOf(stage) <= visibleStage,
    /** 처음 렌더 뒤에 열리는 칸이다. 나타나는 연출을 붙인다. */
    appears: (stage: S) => stages.indexOf(stage) > initialStage,
  };
}

function countValid(steps: boolean[]): number {
  const firstInvalid = steps.indexOf(false);
  return firstInvalid === -1 ? steps.length : firstInvalid;
}
