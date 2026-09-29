# Step 2: check-actions

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (서비스키·외부 API는 server에서만 CRITICAL)
- `/docs/ARCHITECTURE.md` (routes `_actions/`, Server Action에서만 server import)
- `/docs/ADR.md` (ADR-002: Server Action도 `auth()`로 확인)
- `/src/server/auth.ts` (phase 1)
- `/src/server/public-data/juso.ts` (`searchAddress`, `NormalizedAddress`)
- `/src/server/lookup/collect-inputs.ts` (step 0)
- `/src/features/judgment/run.ts` (step 1)
- `/src/features/lookup-input/schema.ts`, `/src/features/rights-input/schema.ts` (phase 2: zod 스키마, `AddressCandidate`)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`/check` 라우트의 Server Action 두 개를 만든다. 서버 데이터와 판정 feature를 조합하는 곳이다.

### 1. 주소 검색 (`src/app/check/_actions/search-address.ts`)

```ts
"use server";
export async function searchAddressAction(keyword: string): Promise<
  { ok: true; candidates: AddressCandidate[] } | { ok: false; error: "unauthorized" | "invalid" | "unavailable" }>;
```

- 먼저 `auth()`로 로그인 확인. 입력 길이 제한.
- `NormalizedAddress` → `AddressCandidate` 변환은 이 파일에서 한다(routes가 조합 담당).

### 2. 판정 실행 (`src/app/check/_actions/run-check.ts`)

```ts
"use server";
export async function runCheckAction(payload: unknown): Promise<
  { ok: true; view: SerializedJudgmentView } | { ok: false; error: CheckError }>;
export type CheckError = "unauthorized" | "invalid-input" | "address-not-found" | "unsupported-house" | "lookup-failed" | "quota";
```

- `auth()` 확인 → `lookupInputSchema`·`rightsInputSchema`로 **서버에서 다시 검증**(클라이언트 검증을 믿지 않는다).
- 선택한 주소는 클라이언트가 보낸 `admCd` 등을 그대로 믿지 말고, 서버에서 juso를 다시 조회해 같은 건물관리번호(`id`)의 결과를 쓴다. 이유: 조작된 법정동코드로 다른 지역 판정이 나오면 안 된다.
- `collectPublicInputs` → `runJudgment`(asOf는 여기서 `new Date()`, routes 레이어이므로 허용).
- 결과의 `Date`는 ISO 문자열로 직렬화한 `SerializedJudgmentView`로 돌려주고, 역직렬화 함수를 `src/features/judgment/serialize.ts`(순수)에 둔다. phase 6 저장에서도 같은 형식을 쓴다. 형식에 `version: 1` 필드를 둔다.
- 오류는 `CheckError` 코드로만 돌려준다. 서버 오류 메시지·스택·서비스키가 담긴 URL을 클라이언트로 보내지 마라.

### 3. 테스트

- `serialize.test.ts`: 왕복 변환 후 같은 값, 버전 필드.
- 액션 테스트: `auth`, `searchAddress`, `collectPublicInputs`를 모킹해 미로그인 거부, 잘못된 입력 거부, 주소 재조회 불일치 시 `address-not-found`, quota 오류 매핑, 성공 시 직렬화 결과.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
grep -n "auth()" src/app/check/_actions/*.ts   # 두 액션 모두 세션을 확인해야 한다
```

## 금지사항

- Server Action에서 `auth()` 확인을 빼지 마라. 이유: ADR-002. Server Action은 공개 엔드포인트로 호출될 수 있다.
- 클라이언트가 보낸 법정동코드·PNU를 그대로 외부 API에 넘기지 마라. 이유: 위 2번.
- 예외 메시지나 원본 오류 객체를 클라이언트에 돌려주지 마라. 이유: 서비스키가 담긴 URL이나 내부 구조가 샌다.
- 결과를 DB에 저장하지 마라. 이유: phase 6 범위다.
- 기존 테스트를 깨뜨리지 마라.
