---
name: jobfit-design
description: jobfit의 화면을 만들거나 고칠 때 쓴다. 디자인 캔버스 아티팩트에서 확정한 색·타이포·간격 토큰과 3분할 결과 화면의 컴포넌트 규격을 담고 있다. UI가 걸린 작업이면 코드를 쓰기 전에 먼저 읽어라 — "입력 화면 만들어줘", "결과 카드 붙여줘", "여기 색 좀 바꿔줘", "Tailwind 설정하자", "레이아웃이 이상한데" 처럼 디자인이라는 말이 안 나오는 요청도 포함한다.
---

# jobfit 디자인 시스템

디자인의 기준은 **`references/artboard.html`** 이다. 디자인 캔버스 아티팩트에서 그대로 뽑은 아트보드이고, 이 문서의 모든 수치가 거기서 나왔다. 추측한 값은 하나도 없다.

출처 아티팩트: `https://claude.ai/code/artifact/dd65fd31-5083-4753-b693-2ed1e5eeb7df`

## 먼저 읽을 것

| 파일 | 언제 |
|---|---|
| `docs/UI_GUIDE.md` | **항상 먼저.** 디자인 원칙과 결정 이력을 읽는다 |
| `references/artboard.html` | **기준 아트보드.** 컴포넌트를 만들 때 연다. 아래 표와 어긋나면 항상 이 파일이 맞다 |
| `references/tokens.css` | 토큰을 프로젝트에 심을 때. **원문 그대로 복사한다.** 값을 바꾸지 마라 |

아트보드는 Design Canvas 문법(`{{ }}`, `sc-if`, `sc-for`, `sc-camel-on-*`)과 인라인 `style`로 되어 있다. **값만 가져오고 마크업 형태는 옮기지 마라.** React + Tailwind로 다시 쓴다.

## 토큰

`references/tokens.css`가 원본이다. 아래는 **아트보드에서 실제로 쓰인 값**만 추린 것이다.

### 색

| 역할 | 값 | 쓰는 곳 |
|---|---|---|
| 페이지·카드 배경 | `#ffffff` | body, 카드, 입력 필드 |
| 본문 잉크 | `#212121` | 요구사항·근거·제안 문장 |
| 액션 | `#17171c` | 분석 버튼 배경, 복사 버튼 테두리·글자 |
| 메타 | `#93939f` | 개수, 출처, 신뢰도, placeholder |
| 보조 본문 | `#75758a` | 고지 문구, 칸 설명, 기간 배지 |
| 규칙선 | `#d9d9dd` | 헤더 밑줄, 칸 상단선, 근거 세로선, missing 행 밑줄 |
| 입력 테두리 | `#e5e7eb` | input, textarea, 기간 배지 |
| 카드 테두리 | `#f2f2f2` | covered 카드, 제안 구획 상단선 |
| **포인트** | `#ff7759` | implicit 칸 상단선(2px), `kind` 배지 배경 |
| 포인트 연함 | `#ffad9b` | implicit 카드 테두리 |

토큰 파일에는 이외에 `--color-navy` · `--color-green-deep` · `--color-wash-blue` 같은 값도 있다. **아트보드가 쓰지 않은 색이다. 용도를 지어내지 마라.** 새 화면에 색이 필요하면 위 표에서 고르고, 표에 없으면 회색조로 해결한다.

세 개는 예외적으로 예약돼 있다: 링크 `#1863dc`, 포커스 링 `#4c6ee6`(`:focus-visible` 2px outline, offset 2px), 입력 포커스 테두리 `#9b60aa`, 에러 `#b30000`.

### 타이포

폰트 세 벌이다. Next.js에서는 `next/font/google`로 불러 `--font-display` / `--font-body` / `--font-mono`에 묶는다.

| 변수 | 폰트 | 쓰는 곳 |
|---|---|---|
| `--font-display` | Space Grotesk | 워드마크, 공고 제목 |
| `--font-body` | Inter | 그 외 전부 |
| `--font-mono` | IBM Plex Mono | 라벨·개수·출처·신뢰도 |

아트보드가 쓴 스케일:

| 용도 | 스타일 |
|---|---|
| 공고 제목 | `400 32px/1.2` display, `letter-spacing -0.32px` |
| 워드마크 | `400 18px/1.2` display, `letter-spacing -0.36px` |
| 칸 제목 (`갖춘 것` 등) | `400 18px/1.3` body |
| 본문 · 요구사항 · 근거 · 제안 | `400 16px/1.5` body |
| 리드 문장 | `400 18px/1.4` body |
| 버튼 | `500 14px/1.71` body |
| 보조 · 고지 · 메타 | `400 14px/1.4` body |
| 라벨 · 배지 · 개수 · 신뢰도 | `400 12px/1.4` mono, `letter-spacing 0.28px` |

mono 라벨은 대문자로 변환한다(`text-transform: uppercase`). 단, **신뢰도만 예외로 변환하지 않는다** — 숫자라서 의미가 없다.

`tokens.css`의 `--type-hero` · `--type-display` 같은 큰 단계는 이 앱이 쓰지 않는다. 랜딩용 스케일이다.

### 간격 · 모서리

- 컨테이너 `max-width: 1180px`, `padding: 40px 24px 80px`
- 3분할 `grid-template-columns: repeat(3, 1fr)`, `gap: 24px`, `align-items: start`
- 카드 안 `gap: 12px`, 칸 안 카드 사이 `gap: 16px`, 결과 섹션 안 `gap: 32px`, 결과 섹션 위 `margin-top: 64px`
- 모서리는 **네 값뿐이다**: 입력 `4px`, 카드 `8px`, 배지 `30px`, 버튼 `32px`
  - **Why:** 전부 같은 반경이면 템플릿처럼 보인다. 반경이 역할을 구분한다.

## 컴포넌트

정확한 마크업은 `references/artboard.html`에 있다. 여기는 규격 요약이다.

### 헤더
높이 `56px`, `border-bottom 1px #d9d9dd`, `padding 0 24px`, 양끝 정렬. 왼쪽 워드마크 `jobfit`, 오른쪽 mono 라벨 `LOCAL · 저장 없음`.

### 입력 줄
`gap 8px`. input은 `flex:1`, `padding 12px 16px`, `border 1px #e5e7eb`, `radius 4px`. 분석 버튼은 `padding 12px 24px`, `radius 32px`, 배경 `#17171c`, 글자 흰색, `transition: background 150ms linear`. 로딩 중 라벨만 `분석 중`으로 바뀐다 — 스피너를 새로 그리지 마라.

붙여넣기 토글은 밑줄 텍스트 버튼(`text-underline-offset 4px`), 배경·테두리 없음.

### 고지 문구
`border-top`·`border-bottom 1px #d9d9dd`, `padding 16px 0`, `14px/1.4`, `#75758a`, 두 줄. 첫 분석 전에만 보이고 결과가 나오면 사라진다. 모달·동의 버튼 없다.

### 결과 헤더
`border-bottom 1px #d9d9dd`, `padding-bottom 20px`, baseline 정렬. mono 출처 위에 display 32px 공고 제목, 오른쪽에 `요구사항 N개 · 저장하지 않음`.

### 칸 머리
`border-top 2px`, `padding-top 12px`, baseline 양끝 정렬. 선 색은 covered·missing이 `#d9d9dd`, **implicit만 `#ff7759`**. 오른쪽에 mono 개수.

implicit 칸에만 머리 아래 설명 한 줄이 붙는다: `근거는 있는데 공고의 용어로 안 적혀 있다. 여기부터 고친다.`

### 카드

| 칸 | 컨테이너 |
|---|---|
| 갖춘 것 | `border 1px #f2f2f2`, `radius 8px`, `padding 16px` |
| 안 쓴 것 | `border 1px #ffad9b`, `radius 8px`, `padding 16px` |
| 없는 것 | 카드 아님. `border-bottom 1px #d9d9dd`, `padding 0 0 16px` |

### 배지
`radius 30px`, `padding 2px 10px`.

- `kind` (covered·missing): mono 12px, 글자 `#212121`, `border 1px #d9d9dd`
- `kind` (implicit): mono 12px, 글자 `#17171c`, **배경 `#ff7759`**, 테두리 없음
- 요구 경력: body 12px, 글자 `#75758a`, `border 1px #e5e7eb`. 값이 있을 때만 렌더한다

### 근거 인용
`border-left 2px #d9d9dd`, `padding-left 12px`, `gap 6px`. 원문 `16px/1.5`, 그 아래 출처 `12px #93939f`(`회사 > 프로젝트`). 원문의 줄바꿈을 보존한다.

### 고쳐 쓴 문장 (implicit 전용)
`border-top 1px #f2f2f2`, `padding-top 12px`, `gap 10px`. mono 라벨 `고쳐 쓴 문장` → 제안 문장 `16px/1.5` → 복사 버튼. 버튼은 `padding 6px 16px`, `radius 32px`, `border 1px #17171c`, 배경 없음. 누르면 라벨이 `복사됨`으로 1.6초간 바뀐다.

### 신뢰도
mono 12px `#93939f`, `신뢰도 0.88` 형식. **막대·게이지·색 코딩 금지.** 모델의 자기평가라 보정된 확률이 아니다. 게이지로 그리면 정밀해 보인다.

## 아이콘

SVG 인라인, `strokeWidth 1.5`. 둥근 배경 박스로 감싸지 않는다. 쓰는 곳은 복사 버튼과 펼침 표시뿐이고, 칸 제목·배지에는 붙이지 마라.

## 아트보드가 정하지 않은 것

기준 아트보드는 데스크톱 1180px, 결과가 있는 상태 하나뿐이다. 나머지는 위 토큰에서 유도하되 아래 선을 지킨다.

| 상황 | 처리 |
|---|---|
| 좁은 화면 | 3분할을 세로로 쌓고 **안 쓴 것을 맨 위**에 둔다 |
| 로딩 | 버튼 라벨만 바뀐다. 스켈레톤·펄스·글로우 금지 |
| 본문 추출 실패 | `#b30000` 텍스트 한 줄 + 그 아래 붙여넣기 textarea. 모달·카드로 감싸지 마라 |
| 빈 상태 | 결과 섹션을 통째로 렌더하지 않는다. 안내 일러스트를 넣지 마라 |
| 판정 없음 | `없는 것`으로 옮기지 말고 그 자리에 `판정 없음`으로 표시한다 |
| 애니메이션 | 결과 등장 `fade-in 0.2s`, 버튼 `background 150ms linear`. 그 외 전부 금지 |

## 하지 마라

| 금지 | 이유 |
|---|---|
| `backdrop-filter: blur()` | glass morphism은 AI 템플릿의 가장 흔한 징후 |
| gradient text · 배경 gradient orb | AI SaaS 랜딩의 1번 특징 |
| box-shadow 글로우 | 이 시스템에 그림자는 아예 없다. 경계는 전부 1~2px 선이다 |
| 보라·인디고 브랜드 색 | "AI = 보라색" 클리셰 |
| 세 칸에 각각 다른 유채색 | 원칙 2를 깬다 |
| 모든 요소에 같은 모서리 반경 | 반경 4/8/30/32이 역할을 나눈다 |
| 칸 제목·배지에 아이콘 | 아이콘은 복사 버튼에만 쓴다 |
| 다크 모드 | 라이트 한 벌만 유지한다 |

## 프로젝트에 심는 법

1. `references/tokens.css`를 `src/app/globals.css`에 그대로 붙인다. `@font-face` 블록은 빼고 `next/font/google`로 대체한다.
2. Tailwind에는 **토큰만** 노출한다 (v4는 `@theme inline`, v3는 `theme.extend`). 컴포넌트 클래스를 Tailwind 설정에 만들지 마라 — 규격은 이 문서와 아트보드에 있고, 설정 파일에 사본을 두면 둘이 갈라진다.
3. 색은 임의값(`bg-[#ff7759]`)이 아니라 토큰 이름으로 쓴다. 임의값이 흩어지면 색을 한 번에 바꿀 수 없다.

## `docs/UI_GUIDE.md`와의 분담

겹치지 않게 나눠 뒀다. 한쪽에 있는 것을 다른 쪽에 옮겨 적지 마라 — 사본이 둘이면 어느 쪽이 최신인지 알 수 없다.

| | 담는 것 |
|---|---|
| `docs/UI_GUIDE.md` | 원칙 · 결정 이력 · 왜 |
| 이 문서 | 색 · 타이포 · 간격 · 컴포넌트 규격 |
| `references/` | 아티팩트 원본. **값이 어긋나면 여기가 맞다** |

디자인을 바꾸려면 아티팩트를 고치고 아트보드를 다시 뽑는다. 이 문서에서 값을 직접 고치면 아트보드와 갈라진다.
