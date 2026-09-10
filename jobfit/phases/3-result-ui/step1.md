# Step 1: result-columns

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `docs/PLAN.md` — 1절(3분할 정의) · 5절
- `docs/PRD.md` — **"두 번째 칸이 이 제품의 존재 이유다"**
- `docs/ARCHITECTURE.md`
- `docs/ADR.md` — ADR-003 · ADR-008
- `docs/UI_GUIDE.md` — **원칙 2(주목을 "안 쓴 것"에) · 원칙 3(근거가 제안보다 먼저) · 원칙 4(색이 아니라 밀도로 가른다)**
- `.claude/skills/jobfit-design/SKILL.md` — **"칸 머리" · "카드" · "고쳐 쓴 문장" 절이 이 step의 규격이다**
- `.claude/skills/jobfit-design/references/tokens.css`
- `.claude/skills/jobfit-design/references/artboard.html` — **기준 아트보드. 세 칸의 마크업이 전부 여기 있다**
- `src/types/index.ts` — `AnalysisItem` · `AnalysisResult`
- `src/components/KindBadge.tsx` · `MonthsBadge.tsx` · `EvidenceQuote.tsx` · `ConfidenceLabel.tsx` · `MonoLabel.tsx` — 이전 step의 조각들
- `src/lib/format.ts`

**이 step은 UI를 만든다.** 하네스는 `codex exec`으로 돌기 때문에 스킬이 자동으로 걸리지 않는다. 위 디자인 파일 세 개를 반드시 직접 열어라.

## 작업

세 칸과 그 안의 카드를 만든다. 결과 섹션 조립과 상태 연결은 다음 step 소관이다.

### 컴포넌트

`src/components/` 아래에 둔다.

- `ColumnHeader` — 칸 머리
- `CoveredCard` · `ImplicitCard` · `MissingRow` — 칸별 항목
- `ResultColumns` — `AnalysisResult`를 받아 3분할 그리드를 그린다

`ImplicitCard`만 복사 버튼 때문에 Client Component다. 나머지는 Server Component로 남긴다.

### 원칙: 색이 아니라 밀도로 가른다

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

1. 배지 줄 (`KindBadge` default + `MonthsBadge`), 가로 `gap 8px`, `flex-wrap`
2. 요구사항 문장 `400 16px/1.5`
3. **근거 인용** — `EvidenceQuote`
4. `ConfidenceLabel`

### `ImplicitCard`

`CoveredCard`와 같은 순서에 **근거 다음, 신뢰도 앞**으로 "고쳐 쓴 문장" 구획이 들어간다. `KindBadge`는 `accent` variant.

고쳐 쓴 문장 구획: `border-top 1px #f2f2f2`, `padding-top 12px`, 세로 `gap 10px`.

1. mono 라벨 `고쳐 쓴 문장`
2. 제안 문장 `400 16px/1.5`
3. 복사 버튼 — `padding 6px 16px`, `radius 32px`, `border 1px #17171c`, 배경 없음, `transition: background 150ms linear`. 누르면 라벨이 `복사됨`으로 **1.6초간** 바뀐다

**근거가 제안보다 위에 온다.** `docs/UI_GUIDE.md` 원칙 3: 제안은 LLM이 쓴 문장이고 근거는 내가 쓴 문장이다. 순서를 바꾸지 마라.

`suggestion`이 `null`이면 이 구획 전체를 렌더하지 않는다. 카드는 여전히 `implicit`이다(근거는 있는데 문장만 안 온 경우다).

복사는 `navigator.clipboard.writeText`. 실패하면 조용히 넘기지 말고 버튼 라벨을 `복사 실패`로 바꾼다.

### `MissingRow`

카드가 아니라 밑줄 행이다. 세로 `gap 10px`. 순서:

1. 배지 줄 (`KindBadge` default + `MonthsBadge`)
2. 요구사항 문장
3. `근거 없음` — `400 14px/1.4`, `#93939f`
4. `ConfidenceLabel`

### `ResultColumns`

`grid-template-columns: repeat(3, 1fr)`, `gap 24px`, `align-items: start`. 칸 안 카드 사이 `gap 16px`.

**근거가 여러 개인 경우**: 아트보드는 근거 하나만 그렸지만 `AnalysisItem.evidence`는 배열이다. `EvidenceQuote`를 개수만큼 세로로 반복하고 사이 간격은 카드 안 `gap 12px`을 따른다. 개수를 제한하거나 접지 마라.

**좁은 화면**: 3분할을 세로로 쌓고 **`안 쓴 것`을 맨 위**에 둔다(`SKILL.md` 명시). Tailwind 반응형으로 처리하되, DOM 순서를 바꾸지 말고 `order`로 재배치한다.

**빈 칸**: 항목이 0개인 칸도 머리와 개수 `0`은 그린다. 3분할 구조가 무너지면 "없다"가 안 보인다. 안내 일러스트나 "비어 있습니다" 문구를 넣지 마라.

`unjudged`는 이 컴포넌트가 그리지 않는다. 다음 step에서 3분할 **바깥**에 별도로 그린다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 통과
npm test        # 기존 테스트 전부 통과
```

추가로 확인한다:

```bash
grep -rn "use client" src/components/CoveredCard.tsx src/components/MissingRow.tsx src/components/ColumnHeader.tsx  # 결과 없음
grep -rn "box-shadow\|shadow-\|backdrop-blur\|gradient\|animate-pulse" src/components/   # 결과 없음
grep -rniE "text-(gray|slate|zinc|blue|purple|indigo)-[0-9]" src/components/             # 결과 없음
grep -rn "localStorage\|sessionStorage\|indexedDB" src/                                   # 결과 없음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `CLAUDE.md` CRITICAL 규칙을 위반하지 않았는가? 특히:
     - **근거 텍스트를 컴포넌트가 가공하지 않는가** (자르기·요약 없음, 줄바꿈 보존)
     - **판정 없음을 `없는 것` 칸에 넣지 않았는가**
     - 저장 계층(localStorage 포함)을 만들지 않았는가
   - **`SKILL.md`의 "하지 마라" 표를 어기지 않았는가?**
   - **토큰에 없는 색을 새로 만들지 않았는가?**
   - 유채색이 `implicit` 칸에만 나타나는가? (`covered`·`missing`에 포인트 색이 없는가)
   - 근거가 제안보다 위에 있는가?
3. 결과에 따라 `phases/3-result-ui/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

`summary`에 만든 컴포넌트 이름과 `ResultColumns`의 props를 적어라.

## 금지사항

- **세 칸에 각각 다른 유채색을 주지 마라.** 이유: `docs/UI_GUIDE.md` 원칙 2 — 세 칸에 각각 색을 주면 신호등이 되고 강조가 사라진다. 이 도구가 존재하는 이유가 두 번째 칸이다
- **제안을 근거보다 위에 두지 마라.** 이유: 원칙 3 — 제안은 LLM이 쓴 문장이고 근거는 내가 쓴 문장이다. 위치·크기·순서 모두에서 근거가 앞선다
- **`covered`의 근거를 접어두고 "근거 보기"로 만들지 마라.** 이유: `docs/UI_GUIDE.md` 결정 이력이 이것을 명시적으로 뒤집어 "처음부터 펼침"으로 정했다
- **판정 없음(`unjudged`)을 `없는 것` 칸에 넣지 마라.** 이유: `SKILL.md` 명시 + `CLAUDE.md` CRITICAL — 대답을 안 한 것과 근거가 없는 것은 다르다
- **근거 개수를 제한하거나 "외 N건"으로 접지 마라.** 이유: 근거는 사용자가 제안과 대조할 대상이다. 가려지면 대조할 수 없다
- **빈 칸에 일러스트나 안내 문구를 넣지 마라.** 이유: `SKILL.md` "빈 상태: 안내 일러스트를 넣지 마라"
- **모든 카드에 같은 모서리 반경을 쓰지 마라.** 이유: 반경 4/8/30/32이 역할을 나눈다. 전부 같으면 템플릿처럼 보인다
- **`missing`을 카드로 만들지 마라.** 이유: 원칙 4 — 밀도가 세 칸을 가른다. `missing`은 밑줄 행이다
- **`box-shadow` · gradient · backdrop-filter · 펄스 애니메이션을 쓰지 마라**
- **`localStorage`에 복사 이력이나 결과를 저장하지 마라.** 이유: ADR-005
- **결과 섹션 헤더와 페이지 조립을 하지 마라.** 이유: 다음 step 소관이다
- 기존 테스트를 깨뜨리지 마라
