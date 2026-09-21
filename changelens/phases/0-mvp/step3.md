# Step 3: summary

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` — 「요약 계층」, 「라우트와 환경변수」
- `/docs/ADR.md` — ADR-4
- Step 1 산출물: `types/git.ts`, `lib/git/index.ts`, `lib/git/show.ts` (`getCommitDetail`, `getCommitPatch`, `CommitNotFoundError`, `isValidSha`, `resolveRepoPath`)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

diff를 Claude에 보내 "이 커밋이 실제로 한 일"을 받고 디스크에 캐시하는 `lib/summary/`와 그 라우트를 만든다. **테스트를 먼저 쓴다.**

### 1. `types/summary.ts`

```ts
export type SummaryResult =
  | { status: "ok"; summary: string; points: string[]; truncated: boolean }
  | { status: "disabled" }                                        // ANTHROPIC_API_KEY 없음
  | { status: "error"; reason: "auth" | "rate-limit" | "refusal" | "failed" };
```

### 2. `lib/summary/`

| 파일 | 내보내는 것 |
|---|---|
| `input.ts` | `buildSummaryInput(detail: CommitDetail, patch: string): { text: string; truncated: boolean }` |
| `cache.ts` | `readCachedSummary(root, repoPath, sha)`, `writeCachedSummary(root, repoPath, sha, result)` — 캐시 루트를 인자로 받는다 |
| `index.ts` | `summarizeCommit(repoPath: string, sha: string, deps?: { client?; cacheRoot?: string }): Promise<SummaryResult>` |

입력 (ADR-4):
- 커밋 메시지 전체, 파일 목록과 numstat **전체**, diff 본문은 **UTF-8 200KB(204,800바이트)**까지. 넘으면 글자가 깨지지 않는 경계에서 자르고 `truncated: true`, 입력 텍스트에도 "diff가 잘렸다"를 적는다.

API 호출 (ARCHITECTURE 「요약 계층」 그대로):
- `new Anthropic({ timeout: 30_000, maxRetries: 1 })`. 기본 클라이언트는 첫 호출 때 만든다(모듈 로드 시 만들지 않는다).
- `client.messages.create({ model: "claude-sonnet-5", max_tokens: 4096, thinking: { type: "adaptive" }, output_config: { effort: "low", format: { type: "json_schema", schema } }, system, messages })`.
- schema: `{ type: "object", properties: { summary: { type: "string" }, points: { type: "array", items: { type: "string" } } }, required: ["summary", "points"], additionalProperties: false }`. `points`는 코드에서 앞 3개만 쓴다.
- 시스템 프롬프트: 한국어 평서문, 커밋 메시지를 옮겨 적지 말고 diff에서 확인되는 것만 쓴다, 추측하지 않는다, 요약은 한 문단.
- `stop_reason`을 먼저 본다: `"refusal"` → `refusal`, `"max_tokens"` → `failed`. 그다음 `content`에서 `type === "text"` 블록을 찾아 `JSON.parse`한다(앞에 thinking 블록이 올 수 있다). 파싱 실패 → `failed`.
- 에러는 이 순서로 가른다: `Anthropic.AuthenticationError` → `auth`, `Anthropic.RateLimitError` → `rate-limit`, `Anthropic.APIConnectionError`(타임아웃 포함) → `failed`, `Anthropic.APIError` → `failed`. `APIConnectionError`는 `APIError`의 하위 클래스이므로 먼저 검사한다.

흐름:
1. `ANTHROPIC_API_KEY`가 없으면 즉시 `{ status: "disabled" }`. API·캐시 모두 건드리지 않는다.
2. 캐시(`~/.changelens/<sha256(저장소 절대경로) 앞 16자>/<전체 sha>.json`)가 있으면 그대로 돌려준다. 읽기·파싱 실패는 캐시 미스.
3. `getCommitDetail` + `getCommitPatch` → 입력 → API → `ok`만 캐시에 쓴다. 쓰기 실패는 무시하고 결과는 돌려준다.
4. 캐시 키는 짧은 sha가 아니라 `detail.sha`(40자)다.

### 3. `app/api/summary/[sha]/route.ts`

- `GET`. Next 15에서 `params`는 `Promise`다.
- `isValidSha` 실패 → 400. `CommitNotFoundError` → 404. 그 밖에는 200 + `SummaryResult` JSON.
- 저장소 경로는 `resolveRepoPath()`.

### 4. 테스트

Anthropic 클라이언트와 캐시 루트를 주입해 검증한다. git은 Step 1의 픽스처 도우미(`tests/helpers/git-fixture.ts`)로 실제 저장소를 쓴다.

- `input`: 200KB 미만 그대로, 초과 시 `truncated` + 안내 문구 + 바이트 수 ≤ 상한 + 한글 경계에서 깨지지 않음, numstat은 잘리지 않음.
- `summarizeCommit`: 키 없음 → `disabled`이고 클라이언트 호출 0회. 정상 → `ok` + 캐시 파일 생성. 두 번째 호출 → 캐시 적중, 클라이언트 호출 0회. `refusal`·`max_tokens`·깨진 JSON → 해당 `error`이고 캐시 없음. `AuthenticationError`·`RateLimitError`·`APIConnectionTimeoutError` → 각각 `auth`·`rate-limit`·`failed`.
- 요청 파라미터에 `budget_tokens`가 없고 `model`·`thinking`·`output_config`가 위와 같은지.

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test
```

## 금지사항

- `thinking.budget_tokens`, 어시스턴트 프리필(마지막 메시지를 assistant로)을 쓰지 마라. 이유: `claude-sonnet-5`에서 400을 받는다.
- SDK 기본 타임아웃(10분)을 그대로 두지 마라. 이유: 상세 페이지 요청을 붙잡는다.
- diff를 조용히 자르지 마라. 이유: ADR-4 — 프롬프트와 결과(`truncated`) 양쪽에 알려야 한다.
- 테스트에서 실제 Anthropic API를 부르거나 실제 `~/.changelens`에 쓰지 마라. 이유: 비용과 개발자 홈 디렉터리 오염.
- `zod` 등 새 패키지를 추가하지 마라. 이유: 스택 고정. 형식은 json_schema + `JSON.parse`로 충분하다.
- 에러 메시지 문자열로 에러 종류를 가르지 마라. 이유: SDK 타입 클래스(`instanceof`)가 있다.
- `ANTHROPIC_API_KEY`를 응답·로그·클라이언트 번들에 흘리지 마라. 이유: CLAUDE.md 서버 전용.
- 화면(요약 카드)을 만들지 마라. 이유: Step 6의 범위다.
