# Step 0: result-columns

## 읽어야 할 파일

**UI step이다. 아래 디자인 파일 셋을 반드시 직접 열어라 — codex는 Claude Code 스킬을 자동으로 부르지 못한다.**

- `.claude/skills/jobfit-design/SKILL.md` — **"배지" · "근거 인용" · "신뢰도" · "칸 머리" · "카드" · "고쳐 쓴 문장" 절이 이 step의 규격이다**
- `.claude/skills/jobfit-design/references/tokens.css` — 토큰 원본
- `.claude/skills/jobfit-design/references/artboard.html` — **기준 아트보드. 세 칸의 마크업이 전부 여기 있다. 문서와 어긋나면 항상 이 파일이 맞다**

그리고:

- `src/types/index.ts` — `AnalysisItem` · `AnalysisResult` · `Requirement` · `ResumeEvidence`
- `src/app/globals.css` — 토큰이 심어진 형태
- `src/components/PostingInput.tsx` · `src/components/Header.tsx` — **기존 컴포넌트의 작성 방식과 Tailwind 사용법을 여기에 맞춘다**

디자인 원칙 넷은 `docs/UI_GUIDE.md`에 있다. 특히 원칙 2(주목을 "안 쓴 것"에) · 3(근거가 제안보다 먼저) · 4(색이 아니라 밀도로 가른다).

아트보드는 Design Canvas 문법과 인라인 `style`로 되어 있다. **값만 가져오고 마크업 형태는 옮기지 마라.** React + Tailwind로 다시 쓴다.

## 작업

세 칸과 그 안의 카드를 만든다. 결과 섹션 조립과 상태 연결은 다음 step 소관이다.

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

테스트 케이스:

1. `12` → `요구 경력 1년`, `36` → `요구 경력 3년`
2. `6` → `요구 경력 6개월`, `42` → `요구 경력 3년 6개월`
3. `0` · `-1` · `NaN` → 빈 문자열
4. `0.876` → `신뢰도 0.88`, `1` → `신뢰도 1.00`

### 2. 컴포넌트

`src/components/` 아래에 둔다. **`ImplicitCard`만 복사 버튼 때문에 Client Component다.** 나머지는 Server Component로 남긴다 (`'use client'`를 붙이지 마라).

파일로 나누는 것은 아래 다섯뿐이다.

- `KindBadge` · `EvidenceQuote` — 여러 카드가 공유한다
- `ColumnHeader` · `CoveredCard` · `ImplicitCard` · `MissingRow` · `ResultColumns`

**mono 라벨 · 신뢰도 · 요구 경력 배지는 별도 컴포넌트로 만들지 마라.** 전부 클래스 몇 개짜리 `<span>`이고, 쓰는 카드 안에 그대로 적는 편이 파일을 오가지 않아 읽기 쉽다. 규격은 아래와 같다.

| 조각 | 규격 |
|---|---|
| mono 라벨 | `400 12px/1.4` mono, `letter-spacing 0.28px`, `uppercase`, `#93939f` |
| 신뢰도 | mono 12px `#93939f`. `formatConfidence` 결과 그대로. **uppercase로 바꾸지 마라** — 숫자라 의미가 없다 |
| 요구 경력 배지 | body 12px, `#75758a`, `border 1px #e5e7eb`, `radius 30px`, `padding 2px 10px`. `formatRequiredMonths`가 빈 문자열이면 **렌더하지 않는다** |

### `KindBadge`

`must` / `nice` 배지. `radius 30px`, `padding 2px 10px`, mono 12px, uppercase.

| variant | 글자 | 배경 | 테두리 |
|---|---|---|---|
| `default` (covered · missing · unjudged) | `#212121` | 없음 | `1px #d9d9dd` |
| `accent` (implicit) | `#17171c` | **`#ff7759`** | 없음 |

포인트 색이 나오는 곳은 이 `accent` variant와 implicit 칸의 상단선·테두리뿐이다.

### `EvidenceQuote`

근거 인용. `ResumeEvidence` 하나를 받는다. `border-left 2px #d9d9dd`, `padding-left 12px`, 세로 `gap 6px`. 원문 `400 16px/1.5` body → 그 아래 출처 `12px #93939f`.

- 출처는 `회사 > 프로젝트` 형식. `company`가 비면 `project`만, 둘 다 비면 출처 줄을 렌더하지 않는다
- **원문의 줄바꿈을 보존한다** (`whitespace-pre-wrap`). 원문은 불릿 + 코드블록을 개행으로 이은 것이라 줄바꿈이 사라지면 읽을 수 없다
- **텍스트를 자르거나 `...`으로 줄이지 마라.** 근거 원문이 제안보다 먼저 읽혀야 한다 (`docs/UI_GUIDE.md` 원칙 3)

### 3. 원칙: 색이 아니라 밀도로 가른다

`docs/UI_GUIDE.md` 원칙 4. 세 칸의 차이는 **구조**다.

| 칸 | 컨테이너 | 상단선 |
|---|---|---|
| 갖춘 것 | `border 1px #f2f2f2`, `radius 8px`, `padding 16px` | `2px #d9d9dd` |
| 안 쓴 것 | `border 1px #ffad9b`, `radius 8px`, `padding 16px` | **`2px #ff7759`** |
| 없는 것 | 카드 아님. `border-bottom 1px #d9d9dd`, `padding 0 0 16px` | `2px #d9d9dd` |

### `ColumnHeader`

`border-top 2px`, `padding-top 12px`, baseline 양끝 정렬. 왼쪽에 칸 제목(`400 18px/1.3` body), 오른쪽에 mono 개수.

`implicit` 칸에만 머리 아래 설명 한 줄이 붙는다 — `400 14px/1.4`, `#75758a`:

> 근거는 있는데 공고의 용어로 안 적혀 있다. 여기부터 고친다.

### `CoveredCard`

카드 안 세로 `gap 12px`. 순서:

1. 배지 줄 (`KindBadge` default + 요구 경력 배지), 가로 `gap 8px`, `flex-wrap`
2. 요구사항 문장 `400 16px/1.5`
3. **근거 인용** — `EvidenceQuote`
4. 신뢰도

### `ImplicitCard`

`CoveredCard`와 같은 순서에 **근거 다음, 신뢰도 앞**으로 "고쳐 쓴 문장" 구획이 들어간다. `KindBadge`는 `accent` variant.

고쳐 쓴 문장 구획: `border-top 1px #f2f2f2`, `padding-top 12px`, 세로 `gap 10px`.

1. mono 라벨 `고쳐 쓴 문장`
2. 제안 문장 `400 16px/1.5`
3. 복사 버튼 — `padding 6px 16px`, `radius 32px`, `border 1px #17171c`, 배경 없음, `transition: background 150ms linear`. 누르면 라벨이 `복사됨`으로 **1.6초간** 바뀐다

**근거가 제안보다 위에 온다.** 원칙 3: 제안은 LLM이 쓴 문장이고 근거는 내가 쓴 문장이다. 순서를 바꾸지 마라.

`suggestion`이 `null`이면 이 구획 전체를 렌더하지 않는다. 카드는 여전히 `implicit`이다(근거는 있는데 문장만 안 온 경우다).

복사는 `navigator.clipboard.writeText`. 실패하면 조용히 넘기지 말고 버튼 라벨을 `복사 실패`로 바꾼다.

### `MissingRow`

카드가 아니라 밑줄 행이다. 세로 `gap 10px`. 순서: 배지 줄 → 요구사항 문장 → `근거 없음`(`400 14px/1.4`, `#93939f`) → 신뢰도.

### `ResultColumns`

`AnalysisResult`를 받아 `grid-template-columns: repeat(3, 1fr)`, `gap 24px`, `align-items: start`. 칸 안 카드 사이 `gap 16px`.

- **근거가 여러 개인 경우**: 아트보드는 근거 하나만 그렸지만 `AnalysisItem.evidence`는 배열이다. `EvidenceQuote`를 개수만큼 세로로 반복한다. 개수를 제한하거나 접지 마라
- **좁은 화면**: 3분할을 세로로 쌓고 **`안 쓴 것`을 맨 위**에 둔다(`SKILL.md` 명시). Tailwind 반응형으로 처리하되, DOM 순서를 바꾸지 말고 `order`로 재배치한다
- **빈 칸**: 항목이 0개인 칸도 머리와 개수 `0`은 그린다. 3분할 구조가 무너지면 "없다"가 안 보인다. 안내 일러스트나 "비어 있습니다" 문구를 넣지 마라
- `unjudged`는 이 컴포넌트가 그리지 않는다. 다음 step에서 3분할 **바깥**에 별도로 그린다

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 통과
npm test        # format 테스트 포함 전부 통과

grep -rn "use client" src/components/CoveredCard.tsx src/components/MissingRow.tsx src/components/ColumnHeader.tsx src/components/KindBadge.tsx src/components/EvidenceQuote.tsx  # 결과 없음
grep -rn "box-shadow\|shadow-\|backdrop-blur\|gradient\|animate-pulse" src/components/   # 결과 없음
grep -rniE "text-(gray|slate|zinc|blue|purple|indigo)-[0-9]" src/components/             # 결과 없음
grep -rn "localStorage\|sessionStorage\|indexedDB" src/                                   # 결과 없음
```

추가로 확인한다: 유채색이 `implicit`에만 나타나는가? 근거가 제안보다 위에 있는가? **`SKILL.md`의 "하지 마라" 표를 어기지 않았는가?** 근거 텍스트를 컴포넌트가 가공하지 않는가(자르기·요약 없음, 줄바꿈 보존)?

UI 컴포넌트에는 테스트를 요구하지 않는다. `src/lib/format.ts`에는 요구한다.

`summary`에 만든 컴포넌트 이름과 `ResultColumns`의 props를 적어라. 다음 step이 이것을 조립한다.

## 금지사항

- **신뢰도를 막대·게이지·프로그레스바로 그리거나 색으로 코딩하지 마라.** 이유: `SKILL.md` 명시 — 모델의 자기평가라 보정된 확률이 아니다. 게이지로 그리면 정밀해 보여서 사용자가 그것을 믿는다
- **근거 원문을 자르거나 `...`으로 줄이거나 "더 보기"로 접지 마라.** 이유: `docs/UI_GUIDE.md` 원칙 3과 결정 이력 — `covered`의 근거를 "처음부터 펼침"으로 명시적으로 뒤집었다
- **근거의 줄바꿈을 없애지 마라.** 이유: 원문은 불릿과 코드블록을 개행으로 이은 것이다. 뭉개면 기술 목록이 한 줄로 붙어 읽을 수 없다
- **근거 개수를 제한하거나 "외 N건"으로 접지 마라.** 이유: 근거는 사용자가 제안과 대조할 대상이다. 가려지면 대조할 수 없다
- **세 칸에 각각 다른 유채색을 주지 마라.** 이유: 원칙 2 — 세 칸에 각각 색을 주면 신호등이 되고 강조가 사라진다. 이 도구가 존재하는 이유가 두 번째 칸이다
- **제안을 근거보다 위에 두지 마라.** 이유: 원칙 3
- **판정 없음(`unjudged`)을 `없는 것` 칸에 넣지 마라.** 이유: `CLAUDE.md` CRITICAL — 대답을 안 한 것과 근거가 없는 것은 다르다
- **`missing`을 카드로 만들지 마라.** 이유: 원칙 4 — 밀도가 세 칸을 가른다. `missing`은 밑줄 행이다
- **모든 카드에 같은 모서리 반경을 쓰지 마라.** 이유: 반경 4/8/30/32가 역할을 나눈다. 전부 같으면 템플릿처럼 보인다
- **잔 조각을 컴포넌트 파일로 쪼개지 마라.** 이유: 클래스 몇 개짜리 `<span>`에 파일 하나씩 붙이면 규격이 흩어지고 파일만 는다
- **배지에 아이콘을 붙이지 마라.** 이유: `SKILL.md` — 아이콘은 복사 버튼에만 쓴다
- **내 경력 개월 수를 계산하거나 요구 기간과 비교하지 마라.** 이유: ADR-009
- **Tailwind 기본 팔레트 색을 쓰지 마라.** 이유: 토큰에 없는 색이다
- **`box-shadow` · gradient · backdrop-filter · 펄스 애니메이션 · 다크 모드를 쓰지 마라**
- **`localStorage`에 복사 이력이나 결과를 저장하지 마라.** 이유: ADR-005
- **결과 섹션 헤더와 페이지 조립을 하지 마라.** 이유: 다음 step 소관이다
