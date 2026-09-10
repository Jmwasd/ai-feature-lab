# Step 0: posting-guards

## 읽어야 할 파일

- `src/types/index.ts` — `JobPosting`
- `src/lib/resume-parser.ts` · `src/lib/resume-parser.test.ts` — **이전 phase에서 만든 순수 함수의 작성 방식·주석 밀도·테스트 스타일을 여기에 맞춘다**
- `vitest.config.ts`

가드레일의 범위는 `docs/PLAN.md` 6절과 ADR-006이 정한다. **"기본만 둔다"가 그 절의 결론이다.**

## 작업

**테스트를 먼저 쓰고 구현한다 (TDD).** `CLAUDE.md`가 `src/lib/`에 대해 이것을 CRITICAL로 요구한다.

파일 두 쌍을 만든다.

- `src/lib/url-guard.ts` · `src/lib/url-guard.test.ts`
- `src/lib/posting-text.ts` · `src/lib/posting-text.test.ts`

### 1. `src/lib/url-guard.ts`

```ts
export type UrlGuardResult =
  | { ok: true; url: URL }
  | { ok: false; reason: 'invalid' | 'scheme' | 'private-host' };

export function checkPostingUrl(raw: string): UrlGuardResult;
```

판정 규칙:

- 파싱 실패 → `invalid`
- 스킴이 `http:` · `https:`가 아니면 → `scheme` (`file:` · `data:` · `ftp:` · `javascript:` 전부 거부)
- 아래 호스트는 → `private-host`
  - `localhost`, 루프백 `127.0.0.0/8`, `::1`, `0.0.0.0`
  - 사설 IPv4 `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
  - 링크로컬 `169.254.0.0/16` (클라우드 메타데이터 엔드포인트가 여기 있다)

**이 목록이 전부다.** IPv6 유니크 로컬·링크로컬·IPv4-mapped IPv6 표기까지 커버하지 마라. `docs/PLAN.md` 6절이 "로컬 개인 도구를 위해 별도 네트워크 프록시나 DNS 재검증 계층은 만들지 않는다"로 정했고, 이 도구에 URL을 넣는 사람은 나 하나다.

**호스트명이 IP 리터럴이 아닌 경우 DNS를 조회하지 않는다.** `src/lib/`은 네트워크를 만질 수 없다.

### 2. `src/lib/posting-text.ts`

```ts
export const MIN_POSTING_LENGTH = 400;
export const MAX_POSTING_CHARS = 20000;

/** 연속 공백·개행을 정리한다. 길이 판정 전에 반드시 거친다 */
export function normalizePostingText(raw: string): string;

/** 본문 추출이 성공했다고 볼 만큼 긴가 */
export function isExtractionSufficient(text: string): boolean;

/** 모델 컨텍스트 한도를 넘지 않게 자른다 */
export function truncatePostingText(text: string): string;
```

- `normalizePostingText`: 3줄 이상 연속 개행을 2줄로, 줄 안의 연속 공백을 하나로, 앞뒤 공백 제거. **줄바꿈 자체는 보존한다** — 공고의 항목 구분이 줄바꿈이라 다 뭉개면 요구사항이 붙어버린다
- `isExtractionSufficient`: `normalizePostingText`를 거친 길이가 `MIN_POSTING_LENGTH` 이상이면 참
- `truncatePostingText`: `MAX_POSTING_CHARS`를 넘으면 자르고, 잘렸다는 표시를 끝에 붙인다

`MIN_POSTING_LENGTH = 400`의 근거: `docs/PLAN.md` 12절이 이 값을 "미결정"으로 남겨 뒀고, 이번에 400으로 확정했다. 한국 채용공고 본문은 보통 1000자를 넘고, 400자 미만이면 네비게이션·푸터·회사 소개만 긁힌 것이다. 값은 상수로 export해서 나중에 한 곳에서 바꿀 수 있게 한다.

### 테스트 케이스

`url-guard`:

1. `https://example.com/jobs/1` · `http://example.com` → ok
2. `ftp://example.com` · `file:///etc/passwd` · `javascript:alert(1)` → `scheme`
3. `not a url` · 빈 문자열 → `invalid`
4. `http://localhost:3000` · `http://127.0.0.1` · `http://[::1]` · `http://0.0.0.0` → `private-host`
5. `http://10.1.2.3` · `http://172.16.0.1` · `http://192.168.0.1` · `http://169.254.169.254` → `private-host`, `http://172.32.0.1` → **ok** (172.16/12 경계 밖)

`posting-text`:

6. 연속 개행 4개가 2개로 줄어든다
7. 줄 안의 연속 공백이 하나로 줄어든다
8. 줄바꿈이 통째로 사라지지 않는다
9. 399자(정규화 후)는 실패, 400자는 성공
10. 공백만 400자면 정규화 후 짧아져 실패한다
11. `MAX_POSTING_CHARS` 이하면 그대로, 넘으면 잘리고 표시가 붙는다

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 통과
npm test        # 위 테스트 전부 통과

grep -nE "^import|require\(|fetch\(|dns" src/lib/url-guard.ts src/lib/posting-text.ts
# @/types 외의 import, fetch, dns 모듈이 있으면 안 된다
```

추가로 확인한다: 테스트를 **먼저** 썼는가?

`summary`에 export한 함수·상수 이름과 값(`MIN_POSTING_LENGTH = 400`, `MAX_POSTING_CHARS = 20000`)을 적어라. 다음 step의 서비스가 그대로 쓴다.

## 금지사항

- **DNS를 조회하지 마라 (`dns` · `net` 모듈 금지).** 이유: `src/lib/`은 순수 함수만 두는 잎이고, `docs/PLAN.md` 6절이 DNS 재검증 계층을 만들지 않기로 정했다
- **`fetch`를 import 하거나 호출하지 마라.** 이유: 네트워크는 `src/services/`만 만진다. 다음 step 소관이다
- **위 목록 밖의 대역을 추가하지 마라.** 이유: 1인 로컬 도구의 가드레일이다. 커버리지를 늘릴수록 테스트와 판정 코드만 늘고 막는 것은 같다
- **줄바꿈을 전부 공백으로 뭉개지 마라.** 이유: 채용공고는 요구사항을 줄바꿈으로 나눈다. 다 뭉개면 LLM이 항목 경계를 못 찾아 원자적 요구사항 추출이 망가진다
- **본문이 짧을 때 조용히 통과시키지 마라.** 이유: ADR-006 — 조용히 실패하지 않는 것이 이 설계의 핵심 대응이다. 판정 함수는 참/거짓을 분명히 낸다
- **허용 도메인 화이트리스트를 만들지 마라.** 이유: 어느 사이트가 되는지는 써보기 전에는 모른다(`docs/PLAN.md` 11절). 화이트리스트는 될 사이트까지 막는다
