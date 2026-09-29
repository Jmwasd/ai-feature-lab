# Step 0: saved-repository

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (server 레이어, Prisma는 `db.ts`에서만)
- `/docs/ADR.md` (ADR-003)
- `/prisma/schema.prisma` (`SavedResult`: `userId`, `input Json`, `result Json`, `dataBaseDate`, cascade delete)
- `/src/server/db.ts`
- `/src/server/trades/repository.ts`, `memory-repository.ts` (phase 4: 인터페이스 + in-memory 구현 + 계약 테스트 패턴)
- `/src/features/judgment/serialize.ts` (phase 5: `SerializedJudgmentView`, `version` 필드. import하지 않는다)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

저장 결과 저장소를 인터페이스 + Prisma 구현 + in-memory 구현으로 만든다.

### 1. 인터페이스 (`src/server/saved/repository.ts`)

```ts
import "server-only";
export interface SavedRecord { id: string; userId: string; input: unknown; result: unknown; dataBaseDate: Date; createdAt: Date }
export interface SavedSummary { id: string; addressDisplay: string; signalCount: number; dataBaseDate: Date; createdAt: Date }
export interface SavedResultRepository {
  create(userId: string, data: { input: unknown; result: unknown; dataBaseDate: Date }): Promise<{ id: string }>;
  listByUser(userId: string, page: { cursor?: string; limit: number }): Promise<{ items: SavedSummary[]; nextCursor: string | null }>;
  getForUser(userId: string, id: string): Promise<SavedRecord | null>;
  deleteForUser(userId: string, id: string): Promise<boolean>;
}
```

- **모든 조회·삭제는 `userId` 조건을 함께 건다.** `id`만으로 찾은 뒤 소유자를 비교하는 방식도 쓰지 말고, 쿼리 조건에 `userId`를 넣는다. 다른 사용자의 id면 `null`/`false`(존재 여부를 드러내지 않는다). 이유: 권리관계·보증금은 개인 정보다.
- `SavedSummary`의 주소·신호 수는 `result` JSON에서 뽑는다. 목록에서 JSON 전체를 읽지 않도록, 필요하면 Prisma `select`로 줄이거나 저장 시 요약 필드를 `result` 최상위에 둔다. 스키마 컬럼 추가가 필요하면 `prisma migrate diff`로 마이그레이션 SQL을 만든다(DB 없이).
- 사용자당 저장 개수 상한을 두려면 정책 수치가 아니므로 이 파일 상수로 둔다.

### 2. 구현과 테스트

- `prisma-repository.ts`, `memory-repository.ts`.
- 계약 테스트 `describeSavedRepositoryContract`를 in-memory에 적용(`*.test.ts`)하고, Prisma 구현에는 `*.db.test.ts`로 적용한다(phase 4의 `test:db` 설정).
- 필수 케이스: 다른 사용자의 결과 조회·삭제 불가, 목록 정렬(최신순)과 커서, 삭제 후 조회 `null`.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 금지사항

- `userId` 조건 없이 `id`만으로 조회·삭제하는 메서드를 만들지 마라. 이유: 다른 사용자의 결과에 접근할 수 있게 된다.
- `src/features/*`를 import하지 마라. 이유: server는 feature를 참조하지 않는다. JSON은 `unknown`으로 다룬다.
- `prisma migrate dev`, `db push`를 실행하지 마라. 이유: 하네스 세션에는 DB가 없다.
- 기존 테스트를 깨뜨리지 마라.
