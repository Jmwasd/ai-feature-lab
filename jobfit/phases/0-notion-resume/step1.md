# Step 1: core-types

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `docs/PLAN.md` — 4절 "데이터 모델"
- `docs/ARCHITECTURE.md` — "데이터 모델" 절
- `docs/ADR.md` — ADR-003(블록 ID 앵커링) · ADR-004(안정 ID를 만들지 않는다) · ADR-009(경력 개월 수를 계산하지 않는다)
- `tsconfig.json` · `vitest.config.ts` — 이전 step에서 만들어진 설정. `@/*` alias가 어디를 가리키는지 확인하라
- `src/app/globals.css` — 이전 step의 산출물

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`src/types/index.ts` 하나에 아래 타입을 선언한다. `docs/ARCHITECTURE.md`의 데이터 모델과 필드 이름·옵셔널 여부가 정확히 일치해야 한다.

```ts
export interface ResumeEvidence {
  blockId: string;   // Notion 블록 ID. 이것이 근거의 앵커다
  text: string;      // Notion 원문. 불릿과 그 아래 코드블록을 이어붙인 결과
  company: string;   // H2에서 뽑은 회사명. 아직 회사가 안 잡힌 위치면 빈 문자열
  project: string;   // H3에서 뽑은 프로젝트명. 없으면 빈 문자열
}

export interface JobPosting {
  sourceUrl?: string;  // 붙여넣기로 들어온 경우 없다
  rawText: string;
}

export type RequirementKind = 'must' | 'nice';

export interface Requirement {
  id: string;
  text: string;
  kind: RequirementKind;
  requiredMonths?: number;  // 공고가 기간을 명시한 경우에만 채운다
}

export type VerdictBucket = 'covered' | 'implicit' | 'missing';

export interface Verdict {
  requirementId: string;
  bucket: VerdictBucket;
  evidenceBlockIds: string[];
  confidence: number;                     // 0~1. 모델의 자기평가다
  suggestion?: string;                    // bucket이 implicit일 때만 채워진다
  suggestionEvidenceBlockIds?: string[];  // 제안이 근거로 삼은 블록 ID
}
```

각 타입 위에 **그 타입이 왜 이 모양인지**를 한두 줄 주석으로 남겨라. 특히:

- `ResumeEvidence.blockId`가 Notion 블록 ID이고 이것이 앵커라는 것 (ADR-003 · ADR-004)
- `Verdict`가 판정과 제안을 **같은 객체**에 담는 이유 (ADR-007 — 호출을 나누면 화면의 근거와 제안의 출처가 어긋난다)
- `Requirement.requiredMonths`는 **공고가 요구하는 기간**이고 내 경력을 계산하는 데 쓰지 않는다는 것 (ADR-009)

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 통과
npm test        # 통과
```

추가로 확인한다:

```bash
npx tsc --noEmit                       # 타입 에러 없음
grep -rn "any" src/types/index.ts      # 결과 없음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `docs/ARCHITECTURE.md`의 데이터 모델과 필드 이름·타입·옵셔널 여부가 정확히 일치하는가?
   - `types/`가 아무것도 import 하지 않는가? (`types/`는 모두가 import 하는 잎이다)
   - `CLAUDE.md` CRITICAL 규칙을 위반하지 않았는가? 특히 저장 계층을 위한 타입(캐시 키, 버전, 타임스탬프 등)을 만들지 않았는가
3. 결과에 따라 `phases/0-notion-resume/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

`summary`에는 파일 경로와 export한 타입 이름을 전부 적어라. 다음 step들이 이것을 import 한다.

## 금지사항

- **런타임 코드를 넣지 마라 — 클래스·함수·상수·zod 스키마 전부.** 이유: 이 파일은 타입 선언만 담는다. 런타임 검증은 `2-llm-matching` phase의 `src/lib/schemas.ts` 소관이고, 두 곳에 검증이 흩어지면 어느 쪽이 진짜인지 알 수 없어진다
- **`any`를 쓰지 마라.** 이유: TS strict mode를 켠 이유가 없어진다
- **`docs/ARCHITECTURE.md`에 없는 타입을 추가하지 마라** — `AnalysisResult` · `AnalyzeResponse` 같은 파생 타입 포함. 이유: 집계 결과 타입은 `2-llm-matching` phase에서 집계 로직과 함께 정해진다. 미리 만들면 로직이 그 모양에 끌려간다
- **이력서 버전·캐시 키·타임스탬프 필드를 넣지 마라.** 이유: ADR-005 — 아무것도 저장하지 않는다. 저장이 없으면 버전도 없다
- **`Verdict`를 판정용과 제안용 둘로 쪼개지 마라.** 이유: ADR-007 — 한 객체에 담아야 화면에 보이는 근거와 제안의 출처가 같아진다
- 기존 테스트를 깨뜨리지 마라
