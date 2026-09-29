# Step 1: save-action

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (routes `_actions/`, 두 라우트 이상에서 쓰면 feature로)
- `/docs/ADR.md` (ADR-002: Server Action도 `auth()` 확인)
- `/docs/UI_GUIDE.md` (§4 `Button`, §1 레드 CTA 개수)
- `/.claude/skills/jeonse-design/SKILL.md`
- `/src/server/saved/*` (step 0)
- `/src/server/auth.ts`
- `/src/features/judgment/serialize.ts`, `run.ts` (phase 5)
- `/src/app/check/_actions/run-check.ts`, `/src/app/check/_components/CheckFlow.tsx` (phase 5)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

결과 화면에서 "결과 저장" 버튼으로 판정 결과를 저장한다.

### 1. 저장 방식

- **클라이언트가 보낸 결과를 그대로 저장하지 마라.** 이유: 조작된 결과(신호 0개 등)가 "저장된 판정"으로 남는다.
- `runCheckAction`이 성공하면 서버에서 결과와 입력을 짧은 수명의 서명 토큰으로 묶어 함께 돌려주거나, 저장 액션이 입력을 받아 서버에서 판정을 다시 실행하는 방식 중 하나를 고른다. 선택과 이유를 파일 상단 주석과 summary에 적는다. 권장: 저장 시 서버 재실행(단, 수집 캐시가 이미 있어 추가 API 호출이 거의 없다).
- 서명 방식을 고르면 `AUTH_SECRET`을 재사용하거나 거기서 파생하지 말고 별도 환경변수(`RESULT_SIGNING_SECRET`)를 쓴다. 이유: 한 비밀값이 새면 세션과 결과 서명이 함께 뚫린다. `.env.example`에 발급 방법과 함께 추가한다.

### 2. 액션 (`src/app/check/_actions/save-result.ts`)

```ts
"use server";
export async function saveResultAction(payload: unknown): Promise<{ ok: true; id: string } | { ok: false; error: "unauthorized" | "invalid" | "limit" | "failed" }>;
```

- `auth()` 확인 → 검증 → 저장. `input`에는 사용자 입력(주소 표시, 보증금, 면적, 동·호, 권리 입력), `result`에는 `SerializedJudgmentView`(version 포함), `dataBaseDate`는 결과의 기준일.

### 3. UI

- `CheckFlow` 결과 화면에 "결과 저장" 버튼(secondary. 레드 CTA 개수 규칙). 저장 후 "저장했어요 · 저장 목록 보기"(`/saved`) 안내. 같은 결과를 두 번 저장하지 않도록 버튼을 비활성화한다.

### 4. 테스트

- 액션: 미로그인 거부, 잘못된 payload 거부, 저장된 결과가 서버 판정 결과와 같음(클라이언트가 보낸 조작된 결과가 저장되지 않음), 상한 초과.
- UI: 저장 성공·실패 표시, 중복 클릭 방지.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
grep -n "auth()" src/app/check/_actions/save-result.ts
```

## 금지사항

- 클라이언트가 보낸 판정 결과 JSON을 검증 없이 저장하지 마라. 이유: 위 1번.
- 저장 액션에서 `auth()`를 빼지 마라. 이유: ADR-002.
- 저장 목록·상세 페이지를 만들지 마라. 이유: step 2 범위다.
- 기존 테스트를 깨뜨리지 마라.
