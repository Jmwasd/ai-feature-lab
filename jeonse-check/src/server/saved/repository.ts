import "server-only";

// 저장 결과 저장소. 운영은 Prisma 구현, 테스트는 in-memory 구현을 쓴다.
// 두 구현은 repository.contract.ts의 같은 계약 테스트를 통과해야 한다.
// 모든 조회·삭제는 쿼리 조건에 userId를 함께 건다. 다른 사용자의 id는 없는 id와 똑같이 다룬다.
// 권리관계·보증금은 개인 정보라 존재 여부도 드러내지 않는다.

/** 사용자당 저장 개수 상한. 정책 수치가 아니라 저장 공간 보호용이라 여기 둔다. */
export const MAX_SAVED_PER_USER = 100;

export interface SavedRecord {
  id: string;
  userId: string;
  input: unknown;
  result: unknown;
  dataBaseDate: Date;
  createdAt: Date;
}

export interface SavedSummary {
  id: string;
  addressDisplay: string;
  signalCount: number;
  dataBaseDate: Date;
  createdAt: Date;
}

export interface SavedResultRepository {
  /** 상한을 넘으면 SavedLimitExceededError, result에서 요약을 뽑을 수 없으면 TypeError. */
  create(userId: string, data: { input: unknown; result: unknown; dataBaseDate: Date }): Promise<{ id: string }>;
  /** 최신순(createdAt 내림차순, 같으면 id 내림차순). cursor는 앞 페이지의 nextCursor다. */
  listByUser(
    userId: string,
    page: { cursor?: string; limit: number },
  ): Promise<{ items: SavedSummary[]; nextCursor: string | null }>;
  getForUser(userId: string, id: string): Promise<SavedRecord | null>;
  deleteForUser(userId: string, id: string): Promise<boolean>;
}

export class SavedLimitExceededError extends Error {
  constructor() {
    super(`저장 결과는 사용자당 ${MAX_SAVED_PER_USER}개까지 둘 수 있습니다.`);
    this.name = "SavedLimitExceededError";
  }
}

/**
 * 목록에 쓰는 요약을 result JSON에서 뽑는다. 목록 조회가 JSON 전체를 읽지 않도록 저장 시 컬럼에 따로 둔다.
 * server는 feature를 참조하지 않으므로 직렬화 형식(address.display, report.signalCount)만 가정하고 값을 검사한다.
 */
export function summarizeResult(result: unknown): { addressDisplay: string; signalCount: number } {
  const addressDisplay = pick(pick(result, "address"), "display");
  const signalCount = pick(pick(result, "report"), "signalCount");
  if (typeof addressDisplay !== "string" || addressDisplay.length === 0) {
    throw new TypeError("저장할 결과에 주소(address.display)가 없습니다.");
  }
  if (typeof signalCount !== "number" || !Number.isInteger(signalCount) || signalCount < 0) {
    throw new TypeError("저장할 결과에 위험 신호 수(report.signalCount)가 없습니다.");
  }
  return { addressDisplay, signalCount };
}

export function assertPageLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError(`limit은 1 이상의 정수여야 합니다: ${limit}`);
}

function pick(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}
