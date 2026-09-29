# Step 2: saved-pages

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (결과 화면 면책 문구·데이터 기준일·출처 CRITICAL)
- `/docs/ARCHITECTURE.md` (routes, Server Component 기본)
- `/docs/ADR.md` (ADR-002: 보호 페이지 서버 확인)
- `/docs/UI_GUIDE.md` (§3, §4, §6 결과 화면 필수 요소)
- `/.claude/skills/jeonse-design/SKILL.md`
- `/src/server/saved/*` (step 0), `/src/app/check/_actions/save-result.ts` (step 1)
- `/src/server/protected-paths.ts`, `/src/proxy.ts` (phase 1: `/saved` 보호)
- `/src/features/judgment/ui/*`, `serialize.ts`
- `/src/features/auth/AuthNavAction.tsx` (phase 1: 내비 인증 영역)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

저장한 결과를 목록·상세로 보고 삭제할 수 있게 한다.

### 1. 목록 (`src/app/saved/page.tsx`)

- 첫 줄에서 `auth()` 확인, 없으면 `/?callbackUrl=/saved`로 리다이렉트.
- 항목: 주소, "위험 신호 N개", 데이터 기준일, 저장일. 최신순, "더 보기"로 커서 페이지네이션.
- 비었으면 "저장한 결과가 없어요" + `/check`로 가는 버튼.
- TopNav 인증 영역에 "저장 목록"(`/saved`) 링크를 더한다.

### 2. 상세 (`src/app/saved/[id]/page.tsx`)

- `auth()` 확인 → `getForUser(userId, id)`. 없거나 남의 것이면 `notFound()`(존재 여부를 드러내지 않는다).
- `result`를 역직렬화해 `ResultView`로 보여준다. UI_GUIDE §6 필수 요소 5개가 모두 보여야 한다.
- 상단에 "{저장일}에 저장한 결과예요. 데이터 기준일은 {기준일}이에요. 지금 다시 조회하면 달라질 수 있어요" 안내와 "같은 조건으로 다시 조회" 버튼(`/check`, 입력을 미리 채움).
- `version`이 모르는 값이면 결과 대신 "이전 형식의 결과라 표시할 수 없어요" 안내를 보인다. 추측해서 변환하지 마라.

### 3. 삭제

- `src/app/saved/_actions/delete-result.ts`: `auth()` → `deleteForUser`. 확인 대화상자 후 실행, 목록으로 이동.

### 4. 테스트

- 목록·상세: `auth`와 repo를 모킹해 미로그인 리다이렉트, 남의 id → `notFound`, 필수 요소 5개 렌더링, 모르는 version 안내, 금지 표현 없음.
- 삭제 액션: 미로그인 거부, 남의 id 삭제 불가.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
grep -n "auth()" src/app/saved/page.tsx src/app/saved/\[id\]/page.tsx src/app/saved/_actions/*.ts
```

## 금지사항

- 페이지·액션의 세션 확인을 proxy에만 맡기지 마라. 이유: ADR-002.
- 다른 사용자의 결과가 있는지 드러내는 응답(403 등)을 쓰지 마라. 이유: `notFound()`로 통일한다.
- 저장된 결과를 현재 정책값으로 다시 계산해 덮어쓰지 마라. 이유: 저장 당시의 판정과 기준일을 보여주는 것이 목적이다. 다시 보려면 새로 조회한다.
- 공유 링크·공개 URL을 만들지 마라. 이유: MVP 범위가 아니고 개인 정보가 노출된다.
- 기존 테스트를 깨뜨리지 마라.
