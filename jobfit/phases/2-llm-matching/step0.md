# Step 0: llm-schemas

## 읽어야 할 파일

- `src/types/index.ts` — `Requirement` · `Verdict` · `RequirementKind` · `VerdictBucket`
- `src/lib/resume-parser.ts` · `src/lib/url-guard.ts` · `src/lib/posting-text.ts` — **기존 순수 함수들의 작성 방식·테스트 스타일을 여기에 맞춘다**
- `vitest.config.ts`

부분 응답 처리의 근거는 `docs/PLAN.md` 7절, 앵커링은 ADR-003에 있다.

## 작업

**테스트를 먼저 쓰고 구현한다 (TDD).** `CLAUDE.md`가 `src/lib/`에 대해 이것을 CRITICAL로 요구한다.

- `src/lib/schemas.test.ts` (먼저)
- `src/lib/schemas.ts` (나중)

### 1. strict JSON Schema 두 개

OpenAI structured outputs에 그대로 넘길 수 있는 plain object로 정의한다.

```ts
export const REQUIREMENTS_SCHEMA: Record<string, unknown>;
export const VERDICTS_SCHEMA: Record<string, unknown>;
```

두 스키마 모두 지켜야 하는 것:

- 최상위는 `object`이고 배열을 담은 필드 하나를 가진다 (`{ requirements: [...] }` · `{ verdicts: [...] }`). OpenAI strict 모드는 최상위 배열을 받지 않는다
- 모든 `object`에 `"additionalProperties": false`
- strict 모드는 **모든 필드가 `required`에 있어야 한다.** 그래서 `requiredMonths` · `suggestion` · `suggestionEvidenceBlockIds` 같은 선택 필드는 `required`에 넣되 타입을 `["number", "null"]` 처럼 null 허용으로 만든다. 코드가 `null`을 `undefined`로 정규화한다
- `kind`는 `enum: ["must", "nice"]`, `bucket`은 `enum: ["covered", "implicit", "missing"]`
- `confidence`는 `number`

각 필드에 짧은 `description`을 붙여라. 모델이 읽는다. 특히 `evidenceBlockIds`에는 **"주어진 근거 목록에 실재하는 블록 ID만. 새로 만들어내지 말 것"**을 적는다.

### 2. 응답 검증 함수

```ts
export interface ParseOutcome<T> {
  items: T[];
  errors: string[];   // 버려진 항목마다 왜 버렸는지 한 줄
}

export function parseRequirements(raw: unknown): ParseOutcome<Requirement>;
export function parseVerdicts(raw: unknown): ParseOutcome<Verdict>;
```

검증 규칙:

- **항목 단위로 판정한다.** 배열 안의 한 항목이 깨졌으면 그 항목만 버리고 나머지는 살린다. 응답 전체를 버리면 `docs/PLAN.md` 7절의 "누락분만 담아 자동으로 한 번 더" 재시도가 불가능해진다
- 최상위가 배열이 아니거나 기대한 필드가 없으면 `items`는 빈 배열, `errors`에 이유 한 줄
- `requirements`:
  - `id`: 비어 있지 않은 문자열. **중복 id는 뒤에 온 것을 버린다**
  - `text`: 비어 있지 않은 문자열
  - `kind`: `'must' | 'nice'` 외의 값이면 버린다. **기본값으로 채우지 마라**
  - `requiredMonths`: 없거나 `null`이면 `undefined`. 값이 있으면 양의 정수여야 하고 아니면 그 필드만 버린다(항목 전체는 살린다)
- `verdicts`:
  - `requirementId`: 비어 있지 않은 문자열
  - `bucket`: 세 값 중 하나. 아니면 버린다
  - `evidenceBlockIds`: 문자열 배열. 문자열이 아닌 원소는 제거. 배열이 아니면 빈 배열로
  - `confidence`: `0 <= x <= 1`인 유한한 수. 범위 밖이면 잘라 넣지 말고 **항목을 버린다** (모델이 스키마를 못 지킨 것이므로 그 판정 전체를 믿을 수 없다)
  - `suggestion`: 없거나 `null`이면 `undefined`
  - `suggestionEvidenceBlockIds`: `evidenceBlockIds`와 같은 규칙
  - 같은 `requirementId`가 여럿이면 **처음 것만** 남긴다

**JSON 문자열 파싱도 받아준다.** `raw`가 문자열이면 `JSON.parse`를 시도하고, 실패하면 `errors`에 남긴다.

### 3. 테스트 케이스

1. 정상 requirements가 통과한다. `{ requirements: [...] }` 래핑과 벌거벗은 배열 둘 다 받는다
2. JSON 문자열로 들어와도 파싱된다. 깨진 JSON은 `errors`에 남고 `items`는 빈 배열
3. `kind`가 `'required'` 같은 엉뚱한 값이거나 아예 없으면 그 항목만 버려진다. **`'must'`로 채우지 않는다**
4. `requiredMonths: null` → `undefined`. `-3` · `2.5`는 그 필드만 빠지고 항목은 살아남는다
5. 중복 `id`는 뒤엣것이 버려진다
6. `confidence: 1.5` · `NaN` → 항목이 버려진다. `0`과 `1`은 통과한다(경계)
7. `bucket`이 세 값 밖이면 항목이 버려진다
8. `evidenceBlockIds`에 숫자가 섞이면 그 원소만 제거된다. 같은 `requirementId`가 두 개면 처음 것만 남는다
9. 버려진 항목마다 `errors`에 한 줄씩 쌓인다

**스키마 상수 자체를 재귀로 훑어 `additionalProperties`와 `required` 완전성을 검사하는 테스트는 만들지 마라.** strict 모드를 어기면 OpenAI가 첫 호출에서 바로 거부한다. 그것을 다시 검사하는 테스트는 유지비만 든다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 통과
npm test        # 위 테스트 전부 통과

grep -nE "^import|require\(" src/lib/schemas.ts
# @/types 외의 import가 있으면 안 된다. openai·zod·ajv·react·next 전부 금지
```

추가로 확인한다: **빠진 필드를 기본값으로 채우지 않았는가?** 테스트를 **먼저** 썼는가?

`summary`에 export한 상수·함수 이름과 `ParseOutcome`의 형태를 적어라. 다음 step들이 전부 이것을 쓴다.

## 금지사항

- **`zod` · `ajv` · `yup` 같은 검증 라이브러리를 설치하지 마라.** 이유: `src/lib/`은 의존성 없는 순수 함수로 유지한다. 스키마가 두 개뿐이라 라이브러리 유지비가 얻는 것보다 크고, `docs/ADR.md`의 "덜 만드는 것" 철학에 어긋난다
- **`openai` 패키지를 import 하지 마라.** 이유: `src/lib/`은 잎이다. SDK 헬퍼로 스키마를 만들면 lib이 네트워크 라이브러리에 묶인다
- **깨진 항목 하나 때문에 응답 전체를 버리지 마라.** 이유: `docs/PLAN.md` 7절 — 누락분만 담아 재시도하려면 어느 항목이 왔고 어느 항목이 없는지 알아야 한다
- **빠진 필드를 기본값으로 채우지 마라** (`kind: 'must'` · `bucket: 'missing'` · `confidence: 0.5` 등). 이유: `CLAUDE.md` — 대답을 안 한 것과 근거가 없는 것은 다르다. 기본값을 채우면 모델이 하지 않은 판단을 코드가 지어낸 것이 된다
- **`confidence`를 범위 안으로 clamp 하지 마라.** 이유: 스키마를 못 지킨 응답은 그 판정 자체를 믿을 근거가 없다. 값을 고쳐 살리면 신뢰도 표시가 거짓이 된다
- **여기서 blockId 실재 검증이나 3분할 집계를 하지 마라.** 이유: 다음 step 소관이다. 이 파일은 "형식이 맞는가"만 본다
