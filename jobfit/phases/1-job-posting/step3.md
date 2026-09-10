# Step 3: input-ui

## 읽어야 할 파일

**UI step이다. 아래 디자인 파일 셋을 반드시 직접 열어라 — codex는 Claude Code 스킬을 자동으로 부르지 못한다.**

- `.claude/skills/jobfit-design/SKILL.md` — 색·타이포·간격·컴포넌트 규격
- `.claude/skills/jobfit-design/references/tokens.css` — 토큰 원본
- `.claude/skills/jobfit-design/references/artboard.html` — **기준 아트보드. 문서와 어긋나면 항상 이 파일이 맞다**

그리고:

- `src/app/globals.css` — 토큰이 심어진 형태
- `src/components/Header.tsx` · `src/app/page.tsx` · `src/app/layout.tsx`
- `src/types/api.ts` — `AnalyzeRequest` · `AnalyzeResponse`
- `src/app/api/analyze/route.ts` — 어떤 응답이 오는지

디자인 원칙 넷은 `docs/UI_GUIDE.md`, 화면 정의는 `docs/PLAN.md` 5절에 있다.

아트보드는 Design Canvas 문법(`{{ }}` · `sc-if` · `sc-for` · `sc-camel-on-*`)과 인라인 `style`로 되어 있다. **값만 가져오고 마크업 형태는 옮기지 마라.** React + Tailwind로 다시 쓴다.

## 작업

랜딩 상태를 만든다. 결과 화면(3분할)은 `3-result-ui` phase 소관이다.

### 컴포넌트

- `src/components/PostingInput.tsx` — 리드 문장 · 입력 줄 · 붙여넣기 토글 · textarea
- `src/components/PrivacyNotice.tsx` — 고지 문구
- `src/app/page.tsx` — 상태를 들고 위를 조립한다

`page.tsx`는 `useState`를 쓰므로 Client Component다. `Header`는 정적이므로 Server Component로 남긴다.

### 상태

`docs/ARCHITECTURE.md`의 상태 기계를 그대로 쓴다. 라이브러리를 쓰지 마라.

```
idle → loading → result
              ↘ needsPaste (본문 추출 실패)
              ↘ error
```

- `idle`: 입력 줄만. 고지 문구가 보인다
- `loading`: 분석 버튼 라벨이 `분석 중`으로 바뀐다. **그것 말고 아무것도 바뀌지 않는다**
- `needsPaste`: `#b30000` 텍스트 한 줄로 서버가 준 메시지를 띄우고, 그 아래 붙여넣기 textarea를 **자동으로 연다**
- `error`: `#b30000` 텍스트 한 줄
- `result`: 고지 문구가 사라진다

새로고침하면 `idle`로 돌아간다. 이것은 결함이 아니라 ADR-005의 결과다.

### 규격

정확한 값은 `SKILL.md`의 "입력 줄" · "고지 문구" 절과 `references/artboard.html`의 첫 `<section>`에 있다. 요지:

- 입력 섹션은 `max-width 720px`, 세로 `gap 24px`
- 리드 문장: `400 18px/1.4` body. 문구는 아트보드 그대로
- 입력 줄: `gap 8px`. input은 `flex:1`, `padding 12px 16px`, `border 1px #e5e7eb`, `radius 4px`
- 분석 버튼: `padding 12px 24px`, `radius 32px`, 배경 `#17171c`, 글자 흰색, `transition: background 150ms linear`
- 붙여넣기 토글: 밑줄 텍스트 버튼(`text-underline-offset 4px`), 배경·테두리 없음
- textarea: `min-height 140px`, `resize: vertical`, input과 같은 테두리·반경. 위에 mono 라벨 `공고 본문`
- 고지 문구: 위아래 `1px #d9d9dd` 선, `padding 16px 0`, `14px/1.4`, `#75758a`, 두 줄. 문구는 아트보드 그대로

색은 임의값(`bg-[#ff7759]`)이 아니라 토큰 이름으로 쓴다. **이 화면에는 포인트 색(coral)이 나오지 않는다** — 그 색은 `implicit` 칸 전용이다.

### 호출

- 분석 버튼 또는 input에서 Enter → `POST /api/analyze`
- textarea가 열려 있고 내용이 있으면 `{ text }`, 아니면 `{ url }`. **둘 다 보내지 마라** (라우트가 400을 낸다)
- 입력이 비어 있으면 호출하지 않는다
- 응답 `status`로 위 상태를 결정한다
- 네트워크 예외는 `error` 상태로 처리한다

### 결과 임시 표시

`status: 'ok'`일 때는 지금 보여줄 결과 화면이 없다. **`<pre>`에 응답 JSON을 그대로 찍는 임시 블록**을 두고, 바로 위에 이런 주석을 남겨라:

```
{/* 임시: 3-result-ui phase의 result-page step에서 3분할 결과 섹션으로 교체한다 */}
```

이것은 M1을 눈으로 검증하기 위한 것이다. 꾸미지 마라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 통과
npm test        # 기존 테스트 전부 통과

grep -rn "process.env\|NOTION_TOKEN\|OPENAI_API_KEY" src/components/ src/app/page.tsx  # 결과 없음
grep -rn "localStorage\|sessionStorage\|indexedDB" src/                                 # 결과 없음
grep -rniE "ff7759|ffad9b|coral" src/components/PostingInput.tsx src/components/PrivacyNotice.tsx  # 결과 없음
grep -rn "box-shadow\|shadow-\|backdrop-blur\|gradient" src/app/ src/components/         # 결과 없음
```

추가로 확인한다: **`SKILL.md`의 "하지 마라" 표를 어기지 않았는가?** 토큰에 없는 색(Tailwind 기본 팔레트 포함)을 쓰지 않았는가? 클라이언트 컴포넌트가 `src/services/`를 import 하지 않고 `/api/analyze`만 부르는가?

UI 컴포넌트에는 테스트를 요구하지 않는다(`docs/PLAN.md` 10절).

**이 step은 `blocked`가 되면 안 된다.** 빌드만으로 완료된다. 실제 분석 실행에 키가 필요한 것과 화면을 만드는 것은 별개다.

`summary`에 만든 컴포넌트 경로와 상태 이름 다섯 개, 그리고 임시 `<pre>` 블록의 위치를 적어라. `3-result-ui`가 그것을 교체한다.

## 금지사항

- **스피너·스켈레톤·펄스·글로우를 만들지 마라.** 이유: `SKILL.md` — 로딩은 버튼 라벨만 바뀐다. 로딩 연출을 넣으면 이 화면이 도구가 아니라 제품 데모처럼 보인다
- **폴백 안내를 모달·카드·토스트로 감싸지 마라.** 이유: `SKILL.md` "본문 추출 실패: `#b30000` 텍스트 한 줄 + 그 아래 붙여넣기 textarea"
- **포인트 색(`#ff7759` · `#ffad9b`)을 쓰지 마라.** 이유: `docs/UI_GUIDE.md` 원칙 2 — 유채색 한 가지를 `implicit` 칸에만 쓴다. 입력 화면이 그 색을 먼저 쓰면 강조가 사라진다
- **히어로 섹션·소개 문단·로고 그래픽·일러스트를 넣지 마라.** 이유: `docs/UI_GUIDE.md` 원칙 1 — 마케팅 페이지가 아니라 작업창이다
- **고지 문구를 모달이나 동의 버튼으로 만들지 마라.** 이유: `SKILL.md` "모달·동의 버튼 없다". 한 번 알리면 되는 사실이지 동의를 받을 일이 아니다
- **`localStorage` · `sessionStorage` · `indexedDB`에 아무것도 쓰지 마라.** 이유: ADR-005 — 새로고침하면 사라지는 것이 이 도구의 결정이다
- **클라이언트에서 Notion·OpenAI를 직접 부르지 마라.** 이유: `CLAUDE.md` CRITICAL. 키가 브라우저 번들에 박힌다
- **`url`과 `text`를 동시에 보내지 마라.** 이유: 라우트가 400을 낸다
- **결과 3분할 화면을 만들지 마라.** 이유: `3-result-ui` phase 소관이다. 규격 없이 미리 만들면 나중에 통째로 버려야 한다
- **`box-shadow` · `backdrop-filter` · gradient · 다크 모드 스타일을 쓰지 마라.** 이유: `SKILL.md` "하지 마라" 표. 이 시스템에 그림자는 없고 경계는 전부 선이며, 팔레트는 라이트 한 벌이다
