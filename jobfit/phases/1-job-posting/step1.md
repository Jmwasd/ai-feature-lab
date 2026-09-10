# Step 1: posting-service

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `docs/PLAN.md` — 6절 "공고 링크를 어떻게 읽는가", 11절 "알려진 약점"
- `docs/ARCHITECTURE.md` — "공고 URL fetch 가드레일" 절
- `docs/ADR.md` — ADR-006
- `src/types/index.ts` — `JobPosting`
- `src/lib/url-guard.ts` — `checkPostingUrl`
- `src/lib/posting-text.ts` — `normalizePostingText` · `isExtractionSufficient` · `truncatePostingText` · 상수들
- `src/services/notion.ts` — **이전 phase의 서비스. `server-only` 사용법과 의존성 주입 방식을 여기에 맞춘다**
- `src/services/notion.test.ts` — mock 테스트 스타일

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`src/services/posting.ts`와 `src/services/posting.test.ts`를 만든다. `@mozilla/readability`와 `jsdom`을 dependency로 설치한다(`@types/jsdom`도).

### 서버 전용 보증

파일 첫 줄에 `import 'server-only';`. 이유는 `src/services/notion.ts`와 같다 — 공고 fetch는 브라우저에서 CORS에 막히고, 서버에서만 돌아야 한다.

### 시그니처

```ts
export type PostingFetchFailure =
  | 'blocked-url'    // url-guard가 거부
  | 'fetch-failed'   // 네트워크 오류 · 4xx · 5xx
  | 'not-html'       // content-type이 HTML이 아니다
  | 'too-large'      // 응답이 크기 상한을 넘었다
  | 'timeout'
  | 'too-short';     // 본문은 뽑혔지만 임계값 미만이다

export type PostingFetchResult =
  | { ok: true; posting: JobPosting; title: string }
  | { ok: false; reason: PostingFetchFailure; message: string };

export interface FetchPostingDeps {
  fetchImpl?: typeof fetch;   // 테스트에서 주입한다
}

export async function fetchPosting(rawUrl: string, deps?: FetchPostingDeps): Promise<PostingFetchResult>;

/** 붙여넣기 경로. 네트워크를 타지 않는다 */
export function postingFromPastedText(text: string): PostingFetchResult;
```

### 가드레일

`docs/ARCHITECTURE.md`가 정한 "기본만 둔다"를 그대로 구현한다.

- **URL 검사**: `checkPostingUrl`을 통과하지 못하면 즉시 `blocked-url`
- **User-Agent**: 일반 브라우저 UA 문자열을 헤더에 넣는다. 봇 차단을 조금이라도 덜 맞기 위해서다
- **타임아웃 10초**: `AbortController`로 끊는다
- **응답 크기 상한 2MB**: 본문을 다 받고 나서 길이를 재지 말고, **스트림을 읽으며 누적 바이트가 상한을 넘는 순간 중단**한다. 다 받고 재면 상한의 의미가 없다
- **리다이렉트 상한 3**: `redirect: 'manual'`로 직접 따라간다. **매 홉마다 `checkPostingUrl`을 다시 통과시킨다.** 공개 URL이 사설 IP로 리다이렉트하는 경로를 막기 위해서다
- **content-type 검사**: `text/html` 또는 `application/xhtml+xml`이 아니면 `not-html`

### 본문 추출

1. 받은 HTML을 `jsdom`으로 파싱한다. `JSDOM` 생성 시 `url` 옵션에 최종 URL을 넘겨 상대 경로가 깨지지 않게 한다
2. jsdom은 **리소스를 가져오지 않고 스크립트를 실행하지 않게** 만든다 (`runScripts`를 켜지 마라, `resources`를 로드하지 마라). 이유: 신뢰할 수 없는 페이지의 스크립트를 서버에서 실행하는 것은 그 자체로 위험하고, 우리가 원하는 것은 정적 HTML의 본문뿐이다
3. `@mozilla/readability`의 `Readability`로 본문을 뽑는다. `textContent`를 쓴다(HTML이 아니라 평문이 필요하다)
4. `normalizePostingText` → `isExtractionSufficient` 판정
   - 미달이면 `{ ok: false, reason: 'too-short' }`. **비어 있는 결과를 성공으로 돌려주지 마라**
5. 통과하면 `truncatePostingText`로 자르고 `JobPosting`을 만든다. `sourceUrl`은 최종 URL
6. `title`은 Readability가 준 제목. 없으면 `<title>`, 그것도 없으면 호스트명

`postingFromPastedText`는 `normalizePostingText` → `isExtractionSufficient` → `truncatePostingText`만 거친다. `sourceUrl`은 넣지 않는다.

### 실패 메시지

`message`는 화면에 그대로 나갈 한국어 한 줄이다. `too-short`와 `fetch-failed`는 `docs/PLAN.md` 6절이 정한 문구를 쓴다:

> 이 사이트는 본문을 읽지 못했습니다. 공고 내용을 복사해 붙여넣어 주세요

### 테스트 (실제 네트워크 없이 mock으로)

`fetchImpl`에 가짜 함수를 주입해 검증한다.

1. 정상 HTML → `ok: true`, 본문에 기사 텍스트가 들어 있다
2. `http://127.0.0.1/x` → `blocked-url` (fetch가 **호출되지 않았음**을 확인한다)
3. 공개 URL → 사설 IP로 302 리다이렉트 → `blocked-url`
4. 리다이렉트 4번 → `fetch-failed` 또는 전용 실패. 무한히 따라가지 않는다
5. 404 응답 → `fetch-failed`
6. `content-type: application/pdf` → `not-html`
7. 본문이 400자 미만인 HTML → `too-short`, 메시지에 붙여넣기 안내가 들어 있다
8. 2MB를 넘는 응답 → `too-large` (전부 읽지 않고 중단했는지 확인한다)
9. `fetchImpl`이 `AbortError`를 던지면 → `timeout`
10. `postingFromPastedText('짧은 글')` → `too-short`
11. `postingFromPastedText`(400자 이상) → `ok: true`, `sourceUrl`이 없다

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 통과
npm test        # 위 테스트 전부 통과
```

추가로 확인한다:

```bash
head -1 src/services/posting.ts                        # import 'server-only';
grep -rn "jsdom\|readability" src/lib/ src/components/ # 결과 없음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 레이어 방향(`app → services → 외부`, `lib`은 잎)을 지켰는가? 판정 로직이 `src/lib/`에 있고 서비스는 그것을 쓰기만 하는가?
   - `CLAUDE.md` CRITICAL 규칙을 위반하지 않았는가? 특히:
     - 저장 계층(파일 캐시 포함)을 만들지 않았는가 — **가져온 HTML을 디스크에 쓰지 않는다**
     - 공고 본문을 비신뢰 데이터로 다루는가 (스크립트 실행 금지, 리소스 로드 금지)
   - 실패를 조용히 넘기지 않고 이유가 붙은 결과로 돌려주는가?
3. 결과에 따라 `phases/1-job-posting/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

**이 step은 `blocked`가 되면 안 된다.** 테스트가 전부 mock이라 네트워크 없이 완료된다.

`summary`에 `fetchPosting` · `postingFromPastedText` 시그니처와 `PostingFetchFailure`의 값들을 적어라. 다음 step의 Route Handler가 이 결과로 분기한다.

## 금지사항

- **실제 채용 사이트를 부르는 테스트를 만들지 마라.** 이유: `docs/PLAN.md` 10절 — 서비스 경계는 mock으로 검증한다. 실제 사이트는 언제든 마크업이 바뀌고 봇 차단에 걸린다
- **jsdom에서 스크립트를 실행하거나 외부 리소스를 로드하지 마라.** 이유: 공고 본문은 비신뢰 데이터다. 남의 페이지 스크립트를 내 서버에서 돌리는 순간 이 도구가 공격 표면이 된다
- **응답을 전부 읽은 뒤에 크기를 재지 마라.** 이유: 그러면 상한이 아무것도 막지 못한다. 스트림을 읽으며 넘는 순간 끊어야 한다
- **리다이렉트 중간 홉의 URL 검사를 건너뛰지 마라.** 이유: 공개 URL이 `169.254.169.254`로 리다이렉트하면 첫 검사만으로는 막지 못한다
- **가져온 HTML이나 추출 본문을 파일·DB에 저장하지 마라.** 이유: ADR-005 — 아무것도 저장하지 않는다
- **본문이 짧을 때 빈 문자열로 성공을 반환하지 마라.** 이유: ADR-006 — 조용히 실패하지 않고 붙여넣기 폴백으로 안내한다
- **허용 도메인 목록이나 사이트별 전용 파서를 만들지 마라.** 이유: `docs/PLAN.md` 11절이 Readability의 한계를 이미 알려진 약점으로 받아들였다. 사이트별 파서는 유지비가 얻는 것을 넘어선다
- **`src/lib/`에 코드를 추가하지 마라.** 이유: 판정 상수와 함수는 이전 step에서 확정됐다. 여기서 또 만들면 사본이 둘이 된다
- 기존 테스트를 깨뜨리지 마라
