# Step 6: commit-detail

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` — 「git 접근 계층」(화면 diff 256KB 상한), 「요약 계층」, 「빈 상태와 에러」
- `/docs/ADR.md` — ADR-4
- `/.claude/skills/design/SKILL.md`, `/.claude/skills/design/guide.md` — §8 「상세 `/repo/[sha]`」, §9 diff·요약 카드 상태
- Step 1 산출물: `types/git.ts`(`CommitDetail`, `FileDiff`), `lib/git/index.ts`(`getCommitDetail`, `isValidSha`, `CommitNotFoundError`, `GitError`, `resolveRepoPath`)
- Step 3 산출물: `types/summary.ts`(`SummaryResult`), `app/api/summary/[sha]/route.ts`
- Step 4·5 산출물: `components/ui/*`, `lib/format.ts`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라. `components/ui/`에 이미 있는 조각은 새로 만들지 말고 쓴다.

## 작업

### 1. `lib/diff-view.ts` (테스트 먼저 — `lib/diff-view.test.ts`)

```ts
export const COLLAPSE_LINES = 300;
export function startsCollapsed(file: FileDiff): boolean;      // lineCount > 300
export function hunkRange(file: FileDiff): string | null;     // 첫 헝크의 "@@ -a,b +c,d @@" 부분, 없으면 null
export function showCommand(sha: string, path: string): string; // `git show <sha> -- <path>` (공백 경로는 따옴표)
```

### 2. `app/repo/[sha]/page.tsx` (서버 컴포넌트)

guide §8 「상세」 구성 그대로. Next 15에서 `params`는 `Promise`다.

- `isValidSha` 실패 또는 `CommitNotFoundError` → `notFound()`.
- `GitError` → 차단·빈 상태 틀에 stderr 첫 줄(Mono).
- 상단 바 `← 커밋 목록`(→ `/repo`) + `shortSha`. 제목 → 메타(작성자, `formatDateTime`, 파일 수, `+`/`−`) → 요약 카드 → 바뀐 파일 → 파일별 diff.
- 요약 카드는 `process.env.ANTHROPIC_API_KEY`가 있을 때만 그린다. 서버는 키 **유무만** 판단하고 키 값은 어디에도 넘기지 않는다.

### 3. `app/repo/[sha]/not-found.tsx`

차단·빈 상태 틀로 404와 `/repo`로 돌아가는 버튼 하나.

### 4. 클라이언트 컴포넌트

- `components/SummaryCard.tsx` — `{ sha: string }`. 마운트 때 `/api/summary/<sha>`를 부른다.
  - 불러오는 동안 스켈레톤 3줄(움직이지 않는다).
  - `ok` → 문단 + 불릿(최대 3개). `truncated`면 카드 아래쪽 캡션으로 diff 일부만 읽고 쓴 요약임을 적는다(ADR-4).
  - `disabled` → 카드를 숨긴다.
  - `error` / 네트워크 실패 → 카드가 한 줄 안내로 접힌다. `auth` → API 키를 확인하라, `rate-limit` → 잠시 후 다시, `refusal`·`failed` → 일반 안내. **나머지 화면(파일 목록·diff)은 그대로다.**
- `components/DiffFile.tsx` — `FileDiff` 하나를 그린다.
  - 머리: 경로(이름 변경이면 `old → new`), `hunkRange`. 머리를 눌러 접고 편다.
  - `startsCollapsed`면 접힌 채 시작하고, **접힌 동안에는 줄을 DOM에 그리지 않는다.**
  - 줄은 `text`를 그대로(앞 `+`/`-` 유지), `kind`에 따라 diff 토큰 색.
  - `binary` → 바이너리 안내. `omitted` → 너무 커서 생략했다는 안내와 `showCommand` 결과(Mono).
- 파일 목록·diff 블록·요약 카드 조각은 `components/ui/`에 둔다(SKILL.md 절차 3).

## Acceptance Criteria

```bash
npm run lint
npm run build                              # 컴파일 에러 없음
npm test                                   # lib/diff-view 테스트 포함
node .claude/skills/design/check_ui.mjs    # 오류 0
```

SKILL.md 절차 5·6대로 검사기가 못 보는 항목(375px에서 diff 가로 스크롤, 초록·빨강이 diff·증감에만 쓰였는지)을 직접 확인하고, 검사기 마지막 줄과 함께 summary에 남긴다. 못 봤으면 못 봤다고 적는다.

## 금지사항

- 페이지나 클라이언트 컴포넌트에서 Anthropic SDK를 import하지 마라. 이유: CLAUDE.md — API 호출은 서버(`lib/summary` + 라우트)에서만. 클라이언트는 `/api/summary`만 부른다.
- 요약 실패 때문에 페이지 전체를 에러로 만들지 마라. 이유: ARCHITECTURE — 요약 칸만 접히고 git 화면은 렌더된다.
- 요약을 서버 컴포넌트 렌더 중에 기다리지 마라. 이유: Claude 응답(최대 30초)이 diff 표시를 막는다.
- 256KB 넘는 파일의 diff를 다시 불러와 그리지 마라. 이유: ARCHITECTURE — 화면 diff 상한.
- diff에 구문 강조, 줄바꿈(`white-space: pre-wrap`), 줄 번호를 넣지 마라. 이유: guide §8·§9.
- guide.md의 값을 코드 주석이나 문서에 옮겨 적지 마라. 이유: 원본은 guide.md 하나다.
- CLI를 만들지 마라. 이유: Step 7의 범위다.
