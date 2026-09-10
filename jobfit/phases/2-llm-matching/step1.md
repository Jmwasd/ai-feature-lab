# Step 1: verdict-aggregation

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `docs/PLAN.md` — 1절(3분할 정의), 3절 "아키텍처 규칙", 7절
- `docs/PRD.md` — 세 칸의 정의와 산출물
- `docs/ARCHITECTURE.md`
- `docs/ADR.md` — ADR-003 · ADR-008(제안의 사실성을 자동 판별하지 않는다)
- `src/types/index.ts` — `Requirement` · `Verdict` · `ResumeEvidence` · `VerdictBucket`
- `src/lib/schemas.ts` — 이전 step의 `ParseOutcome`
- `src/lib/resume-parser.ts` — `ResumeEvidence`가 어떻게 만들어지는지

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 이 step이 하는 일

`docs/ARCHITECTURE.md` 데이터 흐름의 **5단계**다.

> 5. 코드    실재하지 않는 blockId 폐기 · 제안 근거 blockId 존재 검증 · 3분할 집계

`CLAUDE.md`가 CRITICAL로 못박은 것이 여기 다 모여 있다. **집계·계산을 LLM에 시키지 않는다. 근거 텍스트를 LLM이 쓰게 하지 않는다.** 화면에 나가는 근거 문장은 이 함수가 `ResumeEvidence`에서 꺼내온다.

## 작업

**테스트를 먼저 쓰고 구현한다 (TDD).**

- `src/lib/verdicts.test.ts` (먼저)
- `src/lib/verdicts.ts` (나중)

### 1. 타입 추가

`src/types/index.ts`에 아래를 추가한다. (이 phase에서 처음으로 집계 결과의 형태가 정해진다)

```ts
/** 화면 한 항목. LLM이 답하지 않은 요구사항은 bucket이 'unjudged'다 */
export interface AnalysisItem {
  requirement: Requirement;
  bucket: VerdictBucket | 'unjudged';
  evidence: ResumeEvidence[];            // 실재가 검증된 근거만. 원문 그대로
  confidence: number | null;             // 판정이 없으면 null
  suggestion: string | null;             // implicit이고 제안이 있을 때만
  suggestionEvidence: ResumeEvidence[];  // 제안이 근거로 삼은 블록. 실재 검증됨
}

export interface AnalysisResult {
  covered: AnalysisItem[];
  implicit: AnalysisItem[];
  missing: AnalysisItem[];
  unjudged: AnalysisItem[];
}
```

### 2. 함수

```ts
export function buildAnalysis(
  requirements: Requirement[],
  verdicts: Verdict[],
  evidence: ResumeEvidence[],
): AnalysisResult;

/** 재시도용. 아직 판정이 오지 않은 requirement id들 */
export function unjudgedRequirementIds(
  requirements: Requirement[],
  verdicts: Verdict[],
): string[];
```

### 3. 집계 규칙

**근거 실재 검증**

- `evidenceBlockIds`의 각 ID를 `evidence` 목록에서 찾는다. **없으면 버린다.** 경고를 남기고 통과시키지 마라
- 같은 blockId가 여러 번 오면 하나만 남긴다
- 살아남은 근거는 `ResumeEvidence` 객체를 **그대로** 담는다. 텍스트를 자르거나 다듬지 마라 — 화면에 나가는 것이 Notion 원문이어야 사용자가 대조할 수 있다
- `suggestionEvidenceBlockIds`도 같은 규칙으로 검증한다 (ADR-008: 코드는 ID 실재만 본다)

**bucket 배정**

- `verdicts`에서 `requirementId`로 판정을 찾는다. **없으면 `unjudged`**
- `requirements`에 없는 `requirementId`를 가진 verdict는 버린다 (모델이 없는 요구사항을 지어낸 것이다)
- `covered` 또는 `implicit`인데 **유효한 근거가 0개면 `unjudged`로 내린다.** 이유: 근거 ID가 전부 가짜였다는 뜻이므로 그 판정을 믿을 수 없다. 그렇다고 `missing`으로 옮기면 "근거가 없다"고 코드가 단정하는 것인데, 그것은 모델이 한 말이 아니다
- `missing`인데 근거가 딸려 왔으면 **근거를 비운다.** bucket은 `missing` 그대로 둔다
- `implicit`인데 `suggestion`이 없거나 빈 문자열이면 `suggestion`은 `null`. bucket은 `implicit` 그대로 둔다 (근거는 있는데 문장만 안 온 것이다)
- `unjudged`는 `confidence: null`, `evidence: []`, `suggestion: null`

**순서**

- 각 칸 안에서 `requirements`의 입력 순서를 보존한다. 정렬하지 마라 — 정렬 규칙은 화면의 결정이고 여기서 미리 하면 UI가 바꿀 수 없다

### 4. 테스트 케이스 (최소한 이만큼)

1. covered · implicit · missing 하나씩 → 각 칸에 하나씩 들어간다
2. 판정이 없는 requirement → `unjudged`에 들어간다. **`missing`에 들어가지 않는다**
3. `evidenceBlockIds`에 실재하지 않는 ID가 섞이면 그것만 버려지고 실재하는 것은 남는다
4. `evidenceBlockIds`가 **전부** 가짜인 covered → `unjudged`로 내려간다
5. 4번과 같은 상황의 implicit → `unjudged`로 내려간다
6. `missing`인데 근거가 딸려 오면 `evidence`가 빈 배열이 된다
7. 같은 blockId가 두 번 오면 `evidence`에 하나만 남는다
8. `evidence`에 담긴 객체의 `text`가 입력 `ResumeEvidence`의 원문과 **완전히 같다**
9. `suggestionEvidenceBlockIds`의 가짜 ID가 걸러진다
10. `implicit`인데 `suggestion`이 빈 문자열이면 `null`이 되고 bucket은 그대로 `implicit`
11. `requirements`에 없는 `requirementId`의 verdict는 무시된다
12. 각 칸의 순서가 `requirements` 입력 순서를 따른다
13. `unjudgedRequirementIds`가 판정 없는 id만 돌려준다
14. 빈 입력 → 네 칸 모두 빈 배열
15. verdicts가 비면 모든 requirement가 `unjudged`

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 통과
npm test        # 위 테스트 전부 통과
```

추가로 확인한다:

```bash
grep -nE "^import|require\(" src/lib/verdicts.ts   # @/types 외 import 없음
grep -rn "openai\|prompt" src/lib/verdicts.ts       # 결과 없음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/lib/`이 잎으로 남았는가?
   - `CLAUDE.md` CRITICAL 규칙을 위반하지 않았는가? 특히:
     - **근거 텍스트를 코드가 `ResumeEvidence`에서 가져오는가** — 새로 쓰거나 다듬지 않는가
     - **실재하지 않는 블록 ID를 버리는가**
     - **집계를 코드가 하는가** (LLM에 시키는 코드가 없는가)
     - **누락을 `missing`으로 간주하지 않는가**
   - 테스트를 **먼저** 썼는가?
3. 결과에 따라 `phases/2-llm-matching/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

`summary`에 `AnalysisItem` · `AnalysisResult`의 필드와 `buildAnalysis` 시그니처를 적어라. `3-result-ui` phase의 화면이 이 형태를 그대로 렌더한다.

## 금지사항

- **판정 없음(`unjudged`)을 `missing`에 합치지 마라.** 이유: `CLAUDE.md` CRITICAL — 대답을 안 한 것과 근거가 없는 것은 다르다. 합치면 사용자에게 "당신에게 이 경험이 없다"고 거짓을 보여주게 된다
- **실재하지 않는 blockId를 경고만 남기고 통과시키지 마라.** 이유: ADR-003 — 지어낸 근거가 화면에 나가면 사용자가 그것을 이력서에 적는다. 이 도구의 가장 치명적인 실패다
- **근거 텍스트를 새로 쓰거나 요약·정리하지 마라.** 이유: 화면의 근거는 Notion 원문이어야 사용자가 제안과 대조할 수 있다
- **제안 문장의 사실성을 판정하는 로직을 만들지 마라.** 이유: ADR-008 — 코드는 ID 실재만 검증한다. 한국어 표현을 해석해 사실성을 자동 판별하는 검증기는 오탐이 심하고, 근거를 나란히 보여 주고 사람이 판단하는 편이 낫다
- **점수·순위·퍼센트 적합도를 계산하지 마라.** 이유: `docs/PRD.md`의 산출물은 3분할과 문장 제안이다. 적합도 점수는 "되냐 안 되냐"에 답하는 물건이고, 이 도구는 그 질문에 답하지 않는다
- **칸 안을 정렬하지 마라** (must 우선 등). 이유: 정렬은 화면의 결정이다. 여기서 하면 UI가 되돌릴 수 없다
- **`openai`나 프롬프트를 import 하지 마라.** 이유: `src/lib/`은 잎이다
- 기존 테스트를 깨뜨리지 마라
