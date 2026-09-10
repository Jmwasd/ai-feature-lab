# Step 0: result-primitives

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `docs/PLAN.md` — 5절 "페이지 하나"
- `docs/PRD.md` — "화면" 절
- `docs/ARCHITECTURE.md` — "패턴" 절
- `docs/ADR.md` — ADR-003 · ADR-008 · ADR-009
- `docs/UI_GUIDE.md` — **디자인 원칙 넷. 항상 먼저 읽는다**
- `.claude/skills/jobfit-design/SKILL.md` — **"배지" · "근거 인용" · "신뢰도" 절이 이 step의 규격이다**
- `.claude/skills/jobfit-design/references/tokens.css` — 토큰 원본
- `.claude/skills/jobfit-design/references/artboard.html` — **기준 아트보드. 위 문서와 어긋나면 항상 이 파일이 맞다**
- `src/types/index.ts` — `AnalysisItem` · `Requirement` · `ResumeEvidence`
- `src/app/globals.css` — 토큰이 심어진 형태
- `src/components/PostingInput.tsx` · `src/components/Header.tsx` — **기존 컴포넌트의 작성 방식과 Tailwind 사용법을 여기에 맞춘다**

**이 step은 UI를 만든다.** 하네스는 `codex exec`으로 돌기 때문에 Claude Code 스킬이 자동으로 걸리지 않는다. 위 디자인 파일 세 개를 반드시 직접 열어라.

아트보드는 Design Canvas 문법과 인라인 `style`로 되어 있다. **값만 가져오고 마크업 형태는 옮기지 마라.**

## 작업

3분할 카드가 공유하는 작은 조각들을 만든다. 카드와 칸 조립은 다음 step 소관이다.

### 1. `src/lib/format.ts` · `src/lib/format.test.ts` (TDD)

표시 문자열을 만드는 순수 함수다. `CLAUDE.md`가 `src/lib/`에 TDD를 요구하므로 **테스트를 먼저 쓴다.**

```ts
/** 공고가 요구하는 기간을 배지 문구로. 내 경력은 계산하지 않는다 */
export function formatRequiredMonths(months: number): string;

/** '신뢰도 0.88' 형식 */
export function formatConfidence(confidence: number): string;
```

`formatRequiredMonths` 규칙:

- 12의 배수 → `요구 경력 3년`
- 12 미만 → `요구 경력 6개월`
- 나머지가 있으면 → `요구 경력 3년 6개월`
- 0 이하이거나 유한하지 않으면 빈 문자열 (호출부가 렌더하지 않는다)

`formatConfidence`는 소수 둘째 자리까지 (`신뢰도 0.88`). 백분율로 바꾸지 마라 — 아트보드가 소수로 쓴다.

테스트: 12 → `요구 경력 1년` / 36 → `요구 경력 3년` / 6 → `요구 경력 6개월` / 42 → `요구 경력 3년 6개월` / 0 · -1 · NaN → 빈 문자열 / 0.876 → `신뢰도 0.88` / 1 → `신뢰도 1.00`.

### 2. 컴포넌트

전부 **Server Component**로 만든다. 인터랙션이 없다. `'use client'`를 붙이지 마라.

`src/components/` 아래에 둔다.

**`MonoLabel`** — mono 라벨의 공통 조각.
`400 12px/1.4` mono, `letter-spacing 0.28px`, `text-transform: uppercase`, 색 `#93939f`.

**`KindBadge`** — `must` / `nice` 배지.
`radius 30px`, `padding 2px 10px`, mono 12px, uppercase.

| variant | 글자 | 배경 | 테두리 |
|---|---|---|---|
| `default` (covered · missing · unjudged) | `#212121` | 없음 | `1px #d9d9dd` |
| `accent` (implicit) | `#17171c` | **`#ff7759`** | 없음 |

포인트 색이 나오는 곳은 이 `accent` variant와 implicit 칸의 상단선뿐이다.

**`MonthsBadge`** — 요구 경력 배지.
body 12px, 글자 `#75758a`, `border 1px #e5e7eb`, `radius 30px`, `padding 2px 10px`.
`formatRequiredMonths`가 빈 문자열을 주면 **아무것도 렌더하지 않는다**(`null` 반환).

**`EvidenceQuote`** — 근거 인용. `ResumeEvidence` 하나를 받는다.
`border-left 2px #d9d9dd`, `padding-left 12px`, 세로 `gap 6px`.
원문 `400 16px/1.5` body → 그 아래 출처 `12px #93939f`.

- 출처는 `회사 > 프로젝트` 형식. `company`가 비면 `project`만, 둘 다 비면 출처 줄을 렌더하지 않는다
- **원문의 줄바꿈을 보존한다** (`whitespace-pre-wrap`). Notion 원문은 불릿 + 코드블록을 개행으로 이은 것이라 줄바꿈이 사라지면 읽을 수 없다
- **텍스트를 자르거나 `...`으로 줄이지 마라.** 근거 원문이 제안보다 먼저 읽혀야 한다(`docs/UI_GUIDE.md` 원칙 3)

**`ConfidenceLabel`** — 신뢰도.
mono 12px `#93939f`. `formatConfidence` 결과를 그대로.
**mono지만 uppercase로 변환하지 않는다** — 숫자라 의미가 없다(`SKILL.md` 명시).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 통과
npm test        # format 테스트 포함 전부 통과
```

추가로 확인한다:

```bash
grep -rn "use client" src/components/KindBadge.tsx src/components/EvidenceQuote.tsx src/components/ConfidenceLabel.tsx src/components/MonthsBadge.tsx  # 결과 없음
grep -rn "box-shadow\|shadow-\|backdrop-blur\|gradient" src/components/   # 결과 없음
grep -rniE "text-(gray|slate|zinc|blue|purple|indigo)-[0-9]" src/components/  # 결과 없음 (Tailwind 기본 팔레트 금지)
```

UI 컴포넌트에는 테스트를 요구하지 않는다. `src/lib/format.ts`에는 요구한다.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/lib/format.ts`가 순수 함수인가? React를 import 하지 않는가?
   - `CLAUDE.md` CRITICAL 규칙을 위반하지 않았는가? 특히:
     - **근거 텍스트를 컴포넌트가 가공하지 않는가** (자르기·요약·번역 없음)
     - **내 경력 개월 수를 계산하는 코드가 없는가** (ADR-009 — 공고가 요구하는 기간만 표시한다)
     - 저장 계층을 만들지 않았는가
   - **`SKILL.md`의 "하지 마라" 표를 어기지 않았는가?** box-shadow · gradient · backdrop-filter · 아이콘 남용 · 다크 모드 전부 없어야 한다
   - **토큰에 없는 색을 새로 만들지 않았는가?**
   - 신뢰도를 막대·게이지·색 코딩으로 그리지 않았는가?
3. 결과에 따라 `phases/3-result-ui/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

`summary`에 만든 컴포넌트 이름과 각각의 props를 적어라. 다음 step이 이것들을 조립한다.

## 금지사항

- **신뢰도를 막대·게이지·프로그레스바로 그리거나 색으로 코딩하지 마라.** 이유: `SKILL.md` 명시 — 모델의 자기평가라 보정된 확률이 아니다. 게이지로 그리면 정밀해 보여서 사용자가 그것을 믿는다
- **근거 원문을 자르거나 `...`으로 줄이거나 "더 보기"로 접지 마라.** 이유: `docs/UI_GUIDE.md` 원칙 3 — 근거 원문이 제안보다 먼저 읽혀야 한다. `docs/UI_GUIDE.md` 결정 이력이 `covered`의 근거를 "처음부터 펼침"으로 뒤집었다
- **근거의 줄바꿈을 없애지 마라.** 이유: 원문은 불릿과 코드블록을 개행으로 이은 것이다. 뭉개면 기술 목록이 한 줄로 붙어 읽을 수 없다
- **배지에 아이콘을 붙이지 마라.** 이유: `SKILL.md` — 아이콘은 복사 버튼에만 쓴다
- **포인트 색(`#ff7759`)을 `accent` variant 밖에서 쓰지 마라.** 이유: `docs/UI_GUIDE.md` 원칙 2 — 유채색 한 가지를 `implicit`에만 몰아준다
- **내 경력 개월 수를 계산하거나 요구 기간과 비교하지 마라.** 이유: ADR-009 — 이력서로는 회사 재직 기간만 알 수 있고 그것은 공고가 묻는 기술 경력 기간이 아니다
- **Tailwind 기본 팔레트 색(`text-gray-500` 등)을 쓰지 마라.** 이유: 토큰에 없는 색이다
- **`box-shadow` · `backdrop-filter` · gradient를 쓰지 마라.** 이유: 이 시스템에 그림자는 없고 경계는 전부 1~2px 선이다
- **카드·칸·페이지를 만들지 마라.** 이유: 다음 step 소관이다
- 기존 테스트를 깨뜨리지 마라
