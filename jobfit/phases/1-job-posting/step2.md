# Step 2: analyze-route-skeleton

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `docs/PLAN.md` — 7절 "호출 구조와 실패 처리"
- `docs/ARCHITECTURE.md` — "데이터 흐름" 절
- `docs/ADR.md` — ADR-001(로컬 전용) · ADR-005(저장 없음) · ADR-006(폴백)
- `src/types/index.ts`
- `src/services/posting.ts` — `fetchPosting` · `postingFromPastedText` · `PostingFetchFailure`
- `src/services/notion.ts` — `getResumeEvidence`
- `src/lib/posting-text.ts` — 상수
- `src/app/layout.tsx` · `src/app/page.tsx` — 이전 phase의 스캐폴딩

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`src/app/api/analyze/route.ts`를 만든다. 이 프로젝트의 **유일한 Route Handler**다.

`docs/ARCHITECTURE.md`의 6단계 흐름 중 **1·2단계(본문 확보 + 이력서 읽기)까지만** 연결한다. LLM 호출(3~5단계)은 `2-llm-matching` phase에서 붙인다.

### 응답 타입

`src/types/api.ts`를 새로 만들어 여기에 둔다. 클라이언트 컴포넌트도 import 하므로 서버 전용 모듈에 두면 안 된다.

```ts
export interface AnalyzeRequest {
  url?: string;
  text?: string;
}

export type AnalyzeResponse =
  | { status: 'ok'; posting: { title: string; sourceUrl?: string }; evidenceCount: number }
  | { status: 'needs-paste'; message: string }
  | { status: 'error'; message: string };
```

`status: 'ok'`의 형태는 `2-llm-matching` phase에서 3분할 결과를 담도록 확장된다. **지금 그 자리를 미리 만들어 두지 마라** — 집계 결과 타입은 집계 로직과 함께 정해진다.

### 처리 순서

1. **입력 검증**
   - JSON 파싱 실패 → 400 `{ status: 'error' }`
   - `url`과 `text`가 **정확히 하나**여야 한다. 둘 다 있거나 둘 다 없으면 400
   - `url`은 문자열이고 2048자 이하
   - `text`는 문자열이고 `MAX_POSTING_CHARS`의 2배 이하. 넘으면 400 (서비스가 다시 자르지만, 거대한 body를 파싱까지 하고 나서 자르면 늦다)
2. **공고 본문 확보**
   - `url`이면 `fetchPosting`, `text`면 `postingFromPastedText`
   - 실패하면 reason별로 나눈다:
     - `too-short` · `fetch-failed` · `not-html` · `timeout` · `too-large` → **200 + `{ status: 'needs-paste', message }`**. 화면이 붙여넣기 textarea를 열어야 하므로 이것은 에러가 아니라 분기다
     - `blocked-url` → 400 `{ status: 'error', message }`. 사설 IP를 넣은 것은 폴백으로 해결할 문제가 아니다
     - `text` 경로가 `too-short`면 → 400 `{ status: 'error' }`. 이미 붙여넣은 것이 짧은 것이므로 다시 붙여넣기를 열어봐야 소용없다
3. **이력서 읽기**
   - `getResumeEvidence()`
   - 실패하면 500 `{ status: 'error', message }`. 메시지에 **무엇이 잘못됐는지**(환경 변수 이름, Notion 권한 등)를 담아라. 로컬 전용 도구라 에러를 숨길 이유가 없다
   - 근거가 0개면 500 `{ status: 'error' }`. 이력서를 못 읽은 것과 같다
4. **응답**
   - `{ status: 'ok', posting: { title, sourceUrl }, evidenceCount }`

### 런타임 설정

- `export const runtime = 'nodejs';` — jsdom과 Notion SDK가 Edge에서 돌지 않는다
- `export const dynamic = 'force-dynamic';` — 매 요청 새로 계산한다. ADR-005: 아무것도 저장하지 않는다
- `Cache-Control: no-store` 헤더를 응답에 붙인다

### 에러 로깅

서버 콘솔에 실패 원인을 남긴다. 로컬에서 내가 보는 로그라 마스킹하지 않는다(ADR-011). 다만 **`OPENAI_API_KEY` · `NOTION_TOKEN` 값 자체는 절대 로그에 찍지 마라.**

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 통과
npm test        # 기존 테스트 전부 통과
```

추가로 확인한다:

```bash
grep -rn "openai\|gpt-" src/app/api/analyze/route.ts   # 결과 없음 (LLM은 다음 phase)
grep -rn "process.env" src/app/ src/components/         # 결과 없음
grep -rn "NEXT_PUBLIC" src/                             # 결과 없음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 레이어 방향(`app → services → 외부`)을 지켰는가? Route Handler가 `fetch`나 Notion SDK를 **직접** 부르지 않고 `src/services/`를 통하는가?
   - `CLAUDE.md` CRITICAL 규칙을 위반하지 않았는가? 특히:
     - 비밀값을 Route Handler / 서비스 밖으로 흘리지 않았는가 (`NEXT_PUBLIC_*` 없음, 응답 body에 키가 없음)
     - 저장 계층을 만들지 않았는가 (캐시 헤더·메모리 캐시·파일 없음)
     - 집계·계산을 LLM에 시키지 않았는가 (아직 LLM이 없다)
   - 폴백 신호(`needs-paste`)와 진짜 에러(`error`)를 구분했는가?
3. 결과에 따라 `phases/1-job-posting/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

**이 step은 `blocked`가 되면 안 된다.** 빌드와 타입 체크만으로 완료된다. 실제 API 키가 없어도 코드는 완성할 수 있다.

`summary`에 `AnalyzeRequest` · `AnalyzeResponse`의 형태와 파일 경로를 적어라. 다음 step의 입력 화면이 이 타입을 import 한다.

## 금지사항

- **LLM 호출 코드를 넣지 마라.** 이유: `2-llm-matching` phase 소관이다. 여기서 미리 부르면 스키마 검증과 집계가 없는 채로 결과가 화면에 나간다
- **`url`과 `text`를 둘 다 받아 하나를 우선시하지 마라.** 이유: `docs/PLAN.md` 7절이 "정확히 하나"로 못박았다. 우선순위 규칙을 두면 클라이언트가 잘못 보내도 조용히 동작해서 버그가 늦게 발견된다
- **`too-short`를 `{ status: 'error' }`로 내려보내지 마라(URL 경로일 때).** 이유: ADR-006 — 그때 화면은 붙여넣기 textarea를 열어야 한다. 에러로 처리하면 사용자가 막힌다
- **응답이나 중간 결과를 캐시하지 마라.** 이유: ADR-005 — 이력서는 요청 때마다 읽는다
- **Route Handler 안에 파싱·판정 로직을 다시 쓰지 마라.** 이유: 그 로직은 `src/lib/`과 `src/services/`에 있다. 사본이 생기면 테스트가 잡지 못하는 어긋남이 생긴다
- **에러 메시지에 API 키·토큰 값을 담지 마라.** 이유: 응답 body와 로그에 비밀값이 새면 로컬이라도 캡처 화면 하나로 유출된다
- **`GET` 핸들러를 만들지 마라.** 이유: 이 라우트는 `POST` 하나다. GET을 열면 URL만으로 남의 이력서 읽기가 트리거된다
- **UI 컴포넌트를 만들지 마라.** 이유: 다음 step 소관이다
- 기존 테스트를 깨뜨리지 마라
