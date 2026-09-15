import type { Requirement } from "@/types";

const TARGET_BATCH_SIZE = 4;

/** 묶음마다 최대 네 항목을 유지한다. 동시 호출 수는 서비스가 제한한다. */
export function batchRequirements(requirements: Requirement[]): Requirement[][] {
  const count = Math.ceil(requirements.length / TARGET_BATCH_SIZE);

  return Array.from({ length: count }, (_, index) =>
    requirements.slice(
      Math.ceil((index * requirements.length) / count),
      Math.ceil(((index + 1) * requirements.length) / count),
    ),
  );
}
