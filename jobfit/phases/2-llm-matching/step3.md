# Step 3: openai-service

## 읽어야 할 파일

- `src/types/index.ts`
- `src/lib/schemas.ts` — `REQUIREMENTS_SCHEMA` · `VERDICTS_SCHEMA` · `parseRequirements` · `parseVerdicts` · `ParseOutcome`
- `src/lib/verdicts.ts` — `unjudgedRequirementIds`
- `src/prompts/extract-requirements.ts` · `src/prompts/match-verdicts.ts`
- `src/services/notion.ts` · `src/services/posting.ts` — **기존 서비스의 `server-only` 사용법·의존성 주입·mock 테스트 스타일을 여기에 맞춘다**

모델 결정은 `docs/PLAN.md` 2절, 재시도 정책은 7절, 골든 케이스 금지는 ADR-010에 있다.

## 작업

`src/services/openai.ts`와 `src/services/openai.test.ts`를 만든다. `openai` 패키지를 dependency로 설치한다.

### 1. 모델 상수

`src/lib/constants.ts`를 만든다.

```ts
/** 두 LLM 호출이 같은 모델을 쓴다. 여기 한 곳에서만 바꾼다 */
export const OPENAI_MODEL = 'gpt-5';
```

`docs/PLAN.md` 2절: *"두 호출 모두 같은 최상위 모델 하나를 쓰고 모델 ID는 한 곳에 상수로 둔다. LLM에 남은 작업은 전부 판단이라 싼 모델로 아낄 여지가 없다."*

### 2. 서버 전용 보증

파일 첫 줄에 `import 'server-only';`. `OPENAI_API_KEY`가 여기서 읽힌다.

### 3. 시그니처

```ts
/** 테스트에서 주입한다. 실제 구현은 OpenAI SDK를 부른다 */
export interface StructuredCaller {
  call(args: {
    prompt: string;
    schemaName: string;
    schema: Record<string, unknown>;
  }): Promise<unknown>;
}

export interface LlmDeps {
  caller?: StructuredCaller;
}

export async function extractRequirements(
  postingText: string,
  deps?: LlmDeps,
): Promise<{ requirements: Requirement[]; errors: string[] }>;

export async function matchVerdicts(
  requirements: Requirement[],
  evidence: ResumeEvidence[],
  deps?: LlmDeps,
): Promise<{ verdicts: Verdict[]; errors: string[] }>;
```

`caller`를 주지 않으면 `OPENAI_API_KEY`로 실제 클라이언트를 만든다. 키가 없으면 그 이름을 밝힌 에러를 던진다.

### 4. structured outputs

OpenAI SDK의 **strict JSON Schema**(structured outputs)를 쓴다. 설치된 SDK 버전에서 어떤 API가 이것을 지원하는지 확인하고(`node_modules/openai`의 타입 정의를 읽어라) 그에 맞춰 호출하라. `strict: true`와 `src/lib/schemas.ts`의 스키마를 그대로 넘기는 것이 요건이고, 어느 엔드포인트를 쓰는지는 재량이다.

모델은 두 호출 모두 `OPENAI_MODEL`. **다른 모델을 쓰지 마라.**

### 5. 부분 응답 재시도 (핵심)

`docs/PLAN.md` 7절:

> 응답이 일부만 오거나 JSON Schema 검증에 실패하면 누락분만 담아 **자동으로 한 번 더** 부른다. 그래도 없으면 화면에 "판정 없음"으로 남긴다.

`matchVerdicts`의 흐름:

1. `buildMatchVerdictsPrompt(requirements, evidence)` → 호출 → `parseVerdicts`
2. `unjudgedRequirementIds(requirements, verdicts)`로 빠진 것을 계산한다
3. 빠진 것이 있으면 **한 번만** `buildMatchVerdictsPrompt(requirements, evidence, 빠진 id들)`로 재호출한다
4. 두 결과를 병합한다. 같은 `requirementId`는 **첫 응답을 우선**한다
5. 그래도 빠진 것이 있으면 **그대로 둔다.** 채우지 마라

`extractRequirements`는 재시도하지 않는다. 요구사항 목록에는 "빠진 것"을 계산할 기준이 없다. 파싱 결과가 비었으면 빈 배열과 `errors`를 반환한다.

`errors`에는 `ParseOutcome.errors`를 그대로 담는다. Route Handler가 로그로 남긴다.

### 6. 테스트 케이스 (실제 API 없이 mock으로)

`caller`에 가짜를 주입한다.

1. `extractRequirements` 정상 응답 → `Requirement[]`가 나온다
2. `extractRequirements`가 스키마에 안 맞는 응답을 받으면 → 깨진 항목만 빠지고 `errors`에 남는다
3. `matchVerdicts` 정상 응답(전부 판정) → **재호출하지 않는다** (호출 횟수 1)
4. 첫 응답에 3개 중 2개만 오면 → 두 번째 호출이 일어나고 **누락된 id만** 프롬프트에 담긴다. 나머지가 오면 병합되어 총 3개
5. 재시도해도 안 오면 **총 2개만 반환한다.** 없는 것을 만들거나 `missing`으로 채우지 않는다. 재시도는 **한 번뿐이다**(호출 횟수 2를 넘지 않는다)
6. 두 응답에 같은 `requirementId`가 있으면 첫 응답이 이긴다. 두 호출은 같은 모델(`OPENAI_MODEL`)을 쓴다
7. `caller` 없이 `OPENAI_API_KEY`도 없으면 그 이름이 담긴 에러를 던진다

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 통과
npm test        # 위 테스트 전부 통과

head -1 src/services/openai.ts                               # import 'server-only';
grep -rn "gpt-" src/ --include=*.ts | grep -v constants.ts   # 결과 없음 (모델 ID는 한 곳에만)
grep -rn "openai" src/lib/ src/components/ src/prompts/       # 결과 없음
grep -rn "job_posting\|resume_evidence" src/services/openai.ts # 결과 없음 (프롬프트는 파일에 있다)
```

추가로 확인한다: **집계·검증을 여기서 다시 구현하지 않았는가** (`src/lib/`의 함수를 부르는가)? **누락을 `missing`으로 채우지 않았는가?**

**이 step은 `blocked`가 되면 안 된다.** 테스트가 전부 mock이라 `OPENAI_API_KEY` 없이 완료된다.

`summary`에 두 함수의 시그니처, `OPENAI_MODEL` 값, 재시도 정책(한 번, 누락분만)을 적어라.

## 금지사항

- **실제 OpenAI API를 부르는 테스트를 만들지 마라.** 이유: ADR-010 — 매 실행마다 돈이 들고 결과가 흔들린다. 매칭 품질은 화면을 보면서 판단한다
- **재시도해도 안 온 판정을 `missing`으로 채우지 마라.** 이유: `CLAUDE.md` CRITICAL — 대답을 안 한 것과 근거가 없는 것은 다르다. 화면에 "판정 없음"으로 남긴다
- **재시도를 두 번 이상 하지 마라.** 이유: `docs/PLAN.md` 7절이 "자동으로 한 번 더"로 정했다. 무한 재시도는 로컬 도구에 돈만 태운다
- **집계·중복 제거·blockId 실재 검증을 여기서 하지 마라.** 이유: `CLAUDE.md` CRITICAL — 그것은 `src/lib/verdicts.ts`의 일이다. 두 곳에 있으면 어긋난다
- **두 호출에 다른 모델을 쓰거나 모델 ID를 여러 곳에 적지 마라.** 이유: `docs/PLAN.md` 2절. 한 곳에서 바꿀 수 없으면 두 호출이 조용히 갈라진다
- **판정과 제안을 두 번에 나눠 부르지 마라.** 이유: ADR-007
- **응답의 근거 텍스트 필드를 만들거나 쓰지 마라.** 이유: ADR-003 — 근거 텍스트는 코드가 Notion 원문에서 가져온다
- **프롬프트 문자열을 이 파일에 쓰지 마라.** 이유: `CLAUDE.md` — 프롬프트는 `src/prompts/`에 파일로 둔다
- **응답을 캐시하지 마라.** 이유: ADR-005
- **에러 메시지나 로그에 `OPENAI_API_KEY` 값을 담지 마라**
