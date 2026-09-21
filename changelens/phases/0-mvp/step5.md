# Step 5: repo-list

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` — 「git 접근 계층」, 「라우트와 환경변수」, 「빈 상태와 에러」
- `/.claude/skills/design/SKILL.md`, `/.claude/skills/design/guide.md` — §8 「목록 `/repo`」, 「차단 · 빈 상태」, §6 카피(숫자·날짜 형식)
- Step 1 산출물: `types/git.ts`, `lib/git/index.ts` (`getRepoStatus`, `getRepoMetrics`, `listCommits`, `resolveRepoPath`, `GitError`)
- Step 2 산출물: `lib/auth/session.ts` (`SESSION_COOKIE`, `verifySession`), `app/api/session/route.ts` (`DELETE`)
- Step 4 산출물: `components/ui/*`, `app/globals.css`, `app/layout.tsx`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라. `components/ui/`에 이미 있는 조각은 새로 만들지 말고 쓴다.

## 작업

### 1. `lib/format.ts` (테스트 먼저 — `lib/format.test.ts`)

```ts
export function formatCount(n: number): string;                       // 1284 → "1,284"
export function formatSigned(n: number, sign: "+" | "−"): string;     // → "+96,412", "−41,077" (U+2212)
export function formatDateTime(iso: string): string;                  // "2026-09-19T14:22:05+09:00" → "2026-09-19 14:22"
export function formatDate(iso: string): string;                      // → "2026-09-19"
export function formatPeriod(firstIso: string, lastIso: string): string; // 30일 미만 "N일", 이상 "N개월"
export function formatContributors(top: string, count: number): string;  // ("서연", 7) → "서연 외 6명", ("서연", 1) → "서연"
export function shortSha(sha: string): string;                        // 앞 7자
```

- `formatDateTime`·`formatDate`는 ISO 문자열에 적힌 시간대 그대로 보여준다(ARCHITECTURE). `new Date()`로 바꿔 로컬 시간대로 옮기지 마라 — 테스트가 실행 PC 시간대에 따라 달라진다.
- `−`는 U+2212. 하이픈(`-`)이 아닌지 테스트한다.

### 2. `app/api/commits/route.ts`

- `GET ?skip=N`. `N`이 0 이상의 정수가 아니면 400.
- `listCommits(resolveRepoPath(), { skip: N })` → `{ commits: CommitSummary[], nextSkip: number | null }`(50개 미만이면 `null`).
- `GitError` → 500 `{ error: <stderr 첫 줄> }`.

### 3. `app/repo/page.tsx` (서버 컴포넌트)

guide §8 「목록 `/repo`」 구성 그대로.

- 상단 바: 로고 마크, 저장소 경로, `HEAD · <branch>` 배지(detached면 짧은 sha), 세션 이메일(쿠키를 `verifySession`으로 읽는다), 로그아웃.
- 본문: 지표 4종 → 목록 머리 → 커밋 카드 50개 → `50개 더 보기`.
  - 지표: 전체 커밋(`formatCount`) / 기간(`formatPeriod`, 보조 `firstDate → lastDate`) / 추가·삭제 줄(`formatSigned`) / 기여자(보조 `formatContributors`).
  - 커밋 카드 메타: `shortSha · 작성자 · formatDateTime · N files`, 오른쪽 `+추가` `−삭제` `›`. 바이너리만 바뀐 경우 등 숫자가 없으면 guide 범위 안에서 표시한다. 카드 전체가 `/repo/<sha>` 링크.
- `getRepoStatus` 결과별로 차단·빈 상태 틀(Step 4 컴포넌트)을 쓴다:
  - `git-missing` → git 설치 안내
  - `not-repo` → 현재 경로(Mono)와 다시 실행하는 법(`node bin/changelens.mjs <저장소경로>`)
  - `empty` → 아직 커밋이 없다
  - `GitError` → stderr 첫 줄(Mono)

### 4. 클라이언트 컴포넌트

- `components/CommitList.tsx` — 첫 50개를 prop으로 받고, `50개 더 보기`로 `/api/commits?skip=N`을 불러 뒤에 붙인다. 불러오는 동안 버튼 비활성 + `불러오는 중`. 목록 머리의 `N / 전체 · 최신순` 개수도 여기서 갱신한다. 실패하면 버튼 옆에 한 줄 안내.
- `components/LogoutButton.tsx` — `DELETE /api/session` 후 `window.location.assign("/")`.
- 지표 카드·커밋 카드는 `components/ui/`에 둔다(SKILL.md 절차 3).

## Acceptance Criteria

```bash
npm run lint
npm run build                              # 컴파일 에러 없음
npm test                                   # lib/format 테스트 포함
node .claude/skills/design/check_ui.mjs    # 오류 0
```

SKILL.md 절차 5·6대로 검사기가 못 보는 항목(숫자·sha·날짜가 전부 Mono, 375px에서 지표 2×2)을 직접 확인하고, 검사기 마지막 줄과 함께 summary에 남긴다. `npm run dev`로 못 띄웠으면 못 봤다고 적는다.

## 금지사항

- `/repo`를 빌드 때 정적으로 만들지 마라(쿠키를 읽거나 동적 렌더로 둔다). 이유: 빌드 시점의 저장소가 박제된다.
- 페이지나 클라이언트 컴포넌트에서 `child_process`·`lib/git` 내부 파일을 직접 쓰지 마라. 이유: CLAUDE.md — git은 `@/lib/git` 공개 API로만, 클라이언트에서는 API 라우트로만.
- 저장소 경로나 환경변수를 클라이언트 컴포넌트 prop으로 넘기지 마라(화면 표시용 경로 문자열은 서버 컴포넌트가 직접 그린다). 이유: CLAUDE.md — 서버 값이 클라이언트 번들로 새지 않게.
- 무한 스크롤, 검색·필터, 브랜치 전환을 만들지 마라. 이유: guide §9, PRD MVP 제외.
- guide.md의 값을 코드 주석이나 문서에 옮겨 적지 마라. 이유: 원본은 guide.md 하나다.
- 상세 화면(`/repo/[sha]`)을 만들지 마라. 이유: Step 6의 범위다.
