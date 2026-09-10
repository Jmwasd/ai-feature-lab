# Step 2: result-page

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `docs/PLAN.md` — 5절 "페이지 하나", 8절 M3 완료 기준
- `docs/PRD.md` — "화면" 절
- `docs/ARCHITECTURE.md` — "패턴" · "상태 관리" 절
- `docs/ADR.md` — ADR-001 · ADR-005 · ADR-009
- `docs/UI_GUIDE.md` — 디자인 원칙 넷
- `.claude/skills/jobfit-design/SKILL.md` — **"결과 헤더" 절과 "아트보드가 정하지 않은 것" 표**
- `.claude/skills/jobfit-design/references/tokens.css`
- `.claude/skills/jobfit-design/references/artboard.html` — **기준 아트보드. 결과 섹션 전체 구조가 여기 있다**
- `src/app/page.tsx` — **현재 상태 기계와 임시 `<pre>` 블록. 이것을 교체한다**
- `src/components/ResultColumns.tsx` 등 이전 step의 컴포넌트
- `src/components/PostingInput.tsx` · `PrivacyNotice.tsx`
- `src/types/api.ts` — `AnalyzeResponse`
- `src/types/index.ts` — `AnalysisResult` · `AnalysisItem`

**이 step은 UI를 만든다.** 하네스는 `codex exec`으로 돌기 때문에 스킬이 자동으로 걸리지 않는다. 위 디자인 파일 세 개를 반드시 직접 열어라.

## 작업

결과 섹션을 조립하고 페이지에 붙인다. 이 step이 끝나면 **링크 하나를 넣으면 세 칸이 나온다**(M3 완료 기준).

### 1. `src/components/ResultSection.tsx`

`AnalyzeResponse`의 `ok` 갈래를 받아 결과 전체를 그린다.

`margin-top 64px`, 세로 `gap 32px`. 순서:

**a. 결과 헤더** — `border-bottom 1px #d9d9dd`, `padding-bottom 20px`, baseline 양끝 정렬, `flex-wrap`

- 왼쪽 세로 `gap 6px`: mono 출처(`sourceUrl`의 호스트명. 붙여넣기면 `붙여넣은 본문`) 위에, display `400 32px/1.2` `letter-spacing -0.32px` 공고 제목
- 오른쪽: `400 14px/1.4` `#93939f`로 `요구사항 N개 · 저장하지 않음`

**b. `ResultColumns`** — 3분할

**c. 판정 없음 구획** — `result.unjudged`가 비어 있지 않을 때만 렌더한다

`SKILL.md`: *"판정 없음 → `없는 것`으로 옮기지 말고 그 자리에 `판정 없음`으로 표시한다."*

아트보드는 이 상태를 그리지 않았다. 토큰에서 유도하되 다음 선을 지켜라:

- 3분할 **바깥**, 그리드 아래에 둔다. 어느 칸에도 속하지 않기 때문이다
- mono 라벨 `판정 없음` + 그 아래 항목 목록
- 각 항목은 `MissingRow`와 같은 밑줄 행 스타일이되, `근거 없음` 자리에 `판정 없음`을 쓰고 `ConfidenceLabel`은 렌더하지 않는다(`confidence`가 `null`이다)
- **유채색을 쓰지 마라.** 회색조로 해결한다
- 라벨 아래 설명 한 줄을 붙인다: 모델이 이 요구사항에 답하지 않았다는 것, 근거가 없다는 뜻이 아니라는 것

**d. 꼬리 고지** — `border-top 1px #d9d9dd`, `padding-top 16px`, `400 14px/1.4`, `#93939f`. 문구는 아트보드 그대로:

> 신뢰도는 모델의 자기평가다. 보정된 확률이 아니고 검토 필요 신호로만 쓴다. 새로고침하면 결과는 사라진다.

### 2. `src/app/page.tsx`

- 임시 `<pre>` 블록을 **지우고** `ResultSection`으로 교체한다
- `result` 상태일 때 고지 문구(`PrivacyNotice`)가 사라진다 — 첫 분석 전에만 보인다
- 결과 등장 애니메이션은 `fade-in 0.2s` 하나뿐이다. 그 외 전부 금지
- 다시 분석하면 이전 결과를 버리고 새 결과로 바꾼다. 쌓지 마라

### 3. 컨테이너

`main`은 `max-width 1180px`, `padding 40px 24px 80px`. 이미 그렇다면 건드리지 마라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 통과
npm test        # 기존 테스트 전부 통과
```

추가로 확인한다:

```bash
grep -rn "<pre" src/app/page.tsx                                       # 결과 없음 (임시 블록 제거)
grep -rn "localStorage\|sessionStorage\|indexedDB" src/                 # 결과 없음
grep -rn "process.env\|NEXT_PUBLIC" src/app/page.tsx src/components/    # 결과 없음
grep -rn "box-shadow\|shadow-\|backdrop-blur\|gradient\|animate-pulse\|animate-spin" src/app/ src/components/  # 결과 없음
grep -rniE "text-(gray|slate|zinc|blue|purple|indigo)-[0-9]" src/components/ src/app/  # 결과 없음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `npm run dev`로 띄워 **키 없이도 확인 가능한 것**을 본다:
   - `/`가 200으로 뜨고 헤더·입력 줄·고지 문구가 규격대로 보인다
   - 빈 입력으로 분석을 누르면 호출이 일어나지 않는다
   - 잘못된 URL(`http://127.0.0.1`)을 넣으면 에러 한 줄이 뜬다
   - 콘솔에 React 경고나 하이드레이션 에러가 없다

   실제 분석 결과는 `OPENAI_API_KEY`·`NOTION_TOKEN`이 있어야 보인다. **없다고 해서 `blocked`로 만들지 마라** — 코드 완성과 실행 확인은 별개다.
3. 아키텍처 체크리스트를 확인한다:
   - `docs/ARCHITECTURE.md`의 레이어 방향과 상태 기계(`idle → loading → result / needsPaste / error`)를 따르는가?
   - `CLAUDE.md` CRITICAL 규칙을 위반하지 않았는가? 특히:
     - **근거 텍스트가 Notion 원문 그대로 나가는가** (가공·요약 없음)
     - **판정 없음을 `없는 것`으로 옮기지 않았는가**
     - **내 경력 개월 수를 계산·표시하지 않는가** (ADR-009 — 요구 기간 배지만 있다)
     - 저장 계층(localStorage 포함)을 만들지 않았는가
     - 비밀값이 클라이언트로 새지 않았는가
   - **`SKILL.md`의 "하지 마라" 표와 "아트보드가 정하지 않은 것" 표를 지켰는가?**
   - **토큰에 없는 색을 새로 만들지 않았는가?**
4. 결과에 따라 `phases/3-result-ui/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

`summary`에 만든 컴포넌트와 화면이 완성됐다는 사실, 그리고 실제 분석에 필요한 환경 변수 이름을 적어라.

## 금지사항

- **판정 없음(`unjudged`)을 `없는 것` 칸에 합치거나 조용히 버리지 마라.** 이유: `CLAUDE.md` CRITICAL — 대답을 안 한 것과 근거가 없는 것은 다르다. 버리면 요구사항 개수와 세 칸의 합이 안 맞는데 사용자는 그것을 모른다
- **적합도 점수·매칭률·"합격 가능성"을 표시하지 마라.** 이유: `docs/PLAN.md` 1절 — 이 도구는 "내가 되냐 안 되냐"에 답하지 않는다. 답하는 것은 "고쳐서 메울 수 있는 칸이 어디냐"다
- **내 경력 기간을 계산해 요구 기간과 비교하지 마라.** 이유: ADR-009 — 이력서로는 회사 재직 기간만 알 수 있고 그것은 공고가 묻는 기술 경력 기간이 아니다
- **결과를 `localStorage`·`sessionStorage`·URL 쿼리에 저장하지 마라.** 이유: ADR-005 — 새로고침하면 사라지는 것이 결정이다. "결과 공유 링크"도 같은 이유로 만들지 마라
- **결과를 인쇄·PDF·다운로드로 내보내는 기능을 만들지 마라.** 이유: `docs/PRD.md` MVP 제외 사항. 이 도구는 화면에서 보고 고칠 문장을 복사하는 물건이다
- **`fade-in 0.2s`와 버튼 `background 150ms linear` 외의 애니메이션을 넣지 마라.** 이유: `SKILL.md` "그 외 전부 금지"
- **결과를 쌓아 보여주지 마라** (분석 이력·탭·아코디언). 이유: 여러 공고에 걸친 집계는 MVP 제외 사항이다
- **히어로 섹션·소개 문단·일러스트를 넣지 마라.** 이유: 원칙 1 — 작업창이다
- **세 칸에 각각 다른 유채색을 주지 마라.** 이유: 원칙 2
- **`box-shadow` · gradient · backdrop-filter · 다크 모드를 쓰지 마라**
- **`src/lib/` · `src/services/` · `src/app/api/`를 수정하지 마라.** 이유: 이 step은 화면만 만든다. 응답 형태가 부족하면 그것은 설계 문제이므로 `error`로 보고하라
- 기존 테스트를 깨뜨리지 마라
