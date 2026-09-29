# Step 0: api-client

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (서비스키는 `src/server/`에서만, 테스트에서 실제 외부 API 호출 금지 CRITICAL)
- `/docs/ARCHITECTURE.md` (server 레이어, `src/server/public-data/`, mock 레이어 `__fixtures__/`)
- `/.env.example` (`DATA_GO_KR_SERVICE_KEY`, `VWORLD_API_KEY`, `JUSO_API_KEY`)
- `/src/server/db.ts` (server 파일 형식 참고), `/vitest.config.*`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

이 phase의 모든 공공데이터 어댑터가 함께 쓰는 HTTP·환경변수·오류 처리 기반을 만든다.

### 1. 환경변수 (`src/server/env.ts`)

```ts
import "server-only";
export function requireEnv(name: "DATA_GO_KR_SERVICE_KEY" | "VWORLD_API_KEY" | "JUSO_API_KEY"): string;
```

- 호출 시점에 읽는다. 모듈 로드 시 읽지 마라. 이유: 키가 없는 빌드·테스트 환경에서 import만으로 실패하면 안 된다.
- 값이 없으면 `MissingEnvError`(이름만 담고 값은 담지 않는다)를 던진다.

### 2. HTTP 클라이언트 (`src/server/public-data/http.ts`)

```ts
import "server-only";
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export interface HttpOptions { fetch?: FetchLike; timeoutMs?: number; retries?: number }
export async function getText(url: URL, options?: HttpOptions): Promise<string>;
export async function getJson<T = unknown>(url: URL, options?: HttpOptions): Promise<T>;
export class PublicDataError extends Error {
  kind: "timeout" | "http" | "api" | "parse" | "quota";
  source: "molit-trade" | "building" | "vworld" | "juso";
}
```

- 어댑터는 모두 `fetch`를 주입받을 수 있게 한다. 테스트는 fixture 문자열을 돌려주는 가짜 `fetch`를 넘긴다.
- 기본 타임아웃과 재시도 횟수는 정책 수치가 아니므로 이 파일 상수로 둔다. 재시도는 네트워크 오류·5xx·타임아웃에만 하고 4xx·API 오류 코드에는 하지 않는다.
- **오류 메시지·로그에 서비스키가 들어가지 않게 한다.** URL을 메시지에 넣을 때 `serviceKey`, `key`, `confmKey` 쿼리 값을 가린다. 이 가림 함수 `redactUrl(url: URL): string`을 export하고 테스트한다.
- 공공데이터포털은 HTTP 200에 오류 XML(`<resultCode>`/`<returnReasonCode>`, 예: `LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR`)을 돌려줄 수 있다. 이 판별은 각 어댑터가 하되, 한도 초과는 `kind: "quota"`로 통일한다.

### 3. XML 파서

- `fast-xml-parser`를 dependency로 설치하고 `src/server/public-data/xml.ts`에 공용 파서 설정을 둔다. 숫자 자동 변환은 끈다(`"82,500"`, 앞자리 0이 있는 코드가 깨지지 않게). 단일 항목이 배열이 아닌 객체로 오는 경우를 항상 배열로 맞추는 헬퍼를 둔다.

### 4. fixture 로더 (테스트 전용)

- `src/server/public-data/__fixtures__/load.ts`: 같은 폴더의 파일을 문자열로 읽는 헬퍼와, 경로별로 fixture를 돌려주는 가짜 `fetch` 생성기. 이 파일은 mock 레이어다.

### 5. 테스트

- `http.test.ts`: 타임아웃, 5xx 재시도 후 성공, 4xx 즉시 실패, `redactUrl`이 키를 가림, 오류 메시지에 키 원문이 없음.
- `env.test.ts`: 없는 변수에서 `MissingEnvError`, 메시지에 값 없음.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 금지사항

- 테스트에서 실제 네트워크를 호출하지 마라. 이유: CLAUDE.md CRITICAL. 가짜 `fetch`만 쓴다.
- 서비스키를 로그·오류 메시지·예외 객체 필드에 넣지 마라. 이유: 오류 로그로 키가 샌다.
- `axios` 등 HTTP 라이브러리를 설치하지 마라. 이유: 내장 `fetch`로 충분하다.
- `NEXT_PUBLIC_` 접두사 환경변수를 만들지 마라. 이유: 클라이언트 번들로 새어 나간다.
- 개별 API 어댑터를 만들지 마라. 이유: 다음 step 범위다.
- 기존 테스트를 깨뜨리지 마라.
