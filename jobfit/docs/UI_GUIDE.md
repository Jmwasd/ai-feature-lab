# UI 디자인 가이드

`docs/PLAN.md`가 디자인을 정하지 않았으므로 여기서 정한다. 바꾸고 싶으면 이 파일을 고친다.

## 디자인 원칙

1. **도구처럼 보여야 한다.** 마케팅 페이지가 아니라 공고를 볼 때마다 여는 작업창이다. 히어로 섹션도, 소개 문단도, 로고도 없다.
2. **주목을 "안 쓴 것"에 몰아준다.** 유채색은 이 앱 전체에서 한 가지뿐이고, 그 한 가지를 `implicit` 칸에만 쓴다. `covered`는 이미 해결된 것이라 흐리게, `missing`은 지금 할 수 있는 게 없으니 담담하게 둔다.
3. **근거 원문이 제안보다 먼저 읽혀야 한다.** 제안은 LLM이 쓴 문장이고 근거는 내가 쓴 문장이다. 위치·크기·순서 모두에서 근거가 앞선다.

## AI 슬롭 안티패턴 — 하지 마라

| 금지 사항 | 이유 |
|-----------|------|
| `backdrop-filter: blur()` | glass morphism은 AI 템플릿의 가장 흔한 징후 |
| gradient-text (배경 그라데이션 텍스트) | AI가 만든 SaaS 랜딩의 1번 특징 |
| "Powered by AI" 배지 | 기능이 아니라 장식. 사용자에게 가치 없음 |
| box-shadow 글로우 애니메이션 | 네온 글로우 = AI 슬롭 |
| 보라/인디고 브랜드 색상 | "AI = 보라색" 클리셰 |
| 모든 카드에 동일한 `rounded-2xl` | 균일한 둥근 모서리는 템플릿 느낌 |
| 배경 gradient orb (`blur-3xl` 원형) | 모든 AI 랜딩 페이지에 있는 장식 |
| 3분할 칸에 각각 다른 유채색 | 신호등 배치는 예쁘지만 원칙 2를 깬다. 강조는 한 곳뿐이다 |

## 색상

다크 고정이다. 라이트 모드를 만들지 않는다 — 개인 도구 하나에 팔레트를 두 벌 유지할 이유가 없다.

### 배경

| 용도 | 값 |
|------|------|
| 페이지 | `#0f0f0f` |
| 카드 | `#171717` (neutral-900) |
| 근거 인용 블록 | `#111111` |
| 입력 필드 | `#171717` |

### 테두리

| 용도 | 값 |
|------|------|
| 기본 | `#262626` (neutral-800) |
| 포커스 | `#525252` (neutral-600) |

### 텍스트

| 용도 | 값 |
|------|------|
| 주 텍스트 | `text-neutral-100` |
| 본문 | `text-neutral-300` |
| 보조 · 라벨 | `text-neutral-400` |
| 비활성 · 메타 | `text-neutral-500` |

### 유일한 포인트 색

| 용도 | 값 |
|------|------|
| 안 쓴 것 (`implicit`) 강조 | `#f59e0b` (amber-500) |
| 그 배경 | `rgba(245, 158, 11, 0.08)` |

**이 색은 `implicit` 칸 밖에서 쓰지 않는다.** 버튼에도, 링크에도, 포커스 링에도 쓰지 마라.

### 상태 색

| 용도 | 값 | 쓰는 곳 |
|------|------|------|
| 에러 | `#ef4444` | 본문 추출 실패 안내, API 실패 |
| 그 외 | 없음 | 성공 표시에 초록을 쓰지 않는다 |

## 3분할 칸의 표현

색이 아니라 **밀도와 테두리**로 가른다.

| 칸 | 표현 |
|---|---|
| 갖춘 것 | 기본 카드. 제목 `text-neutral-400`. 근거는 접어두고 "근거 보기"로 편다 |
| 안 쓴 것 | 왼쪽 `border-l-2 border-[#f59e0b]` + amber 배경. 근거와 제안이 처음부터 펼쳐져 있다 |
| 없는 것 | 기본 카드. 제목 `text-neutral-400`. 항목만 나열한다 |

## 컴포넌트

### 카드 (요구사항 항목)

```
rounded-md bg-[#171717] border border-neutral-800 px-4 py-3
```

`implicit`만 `border-l-2 border-l-[#f59e0b] bg-[rgba(245,158,11,0.08)]`를 덧입는다.

### 근거 인용 블록

```
border-l border-neutral-700 bg-[#111] pl-3 py-2 text-sm text-neutral-300
```

위에 소속을 `text-xs text-neutral-500`로 `회사 › 프로젝트` 형식으로 붙인다. 인용 안의 줄바꿈은 Notion 원문 그대로 유지한다.

### 배지

```
must:          rounded-sm border border-neutral-600 px-1.5 py-0.5 text-xs text-neutral-200
nice:          rounded-sm border border-neutral-800 px-1.5 py-0.5 text-xs text-neutral-500
요구 경력:      text-xs text-neutral-500  (테두리 없음. 숫자만 읽히면 된다)
신뢰도:         text-xs text-neutral-500  ("신뢰도 0.62" 처럼 숫자로 쓴다. 막대·게이지 금지)
```

신뢰도를 막대로 그리지 않는 이유: 모델의 자기평가라 보정된 확률이 아니다. 게이지로 그리면 정밀해 보인다.

### 버튼

```
Primary (분석 · 복사):  rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 text-sm
                        hover:bg-white  disabled:bg-neutral-700 disabled:text-neutral-500
Text (근거 보기 등):     text-sm text-neutral-500 hover:text-neutral-300
```

### 입력 필드

```
rounded-md bg-[#171717] border border-neutral-800 px-3 py-2.5 text-sm
placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none
```

### 폴백 안내 (본문 추출 실패)

에러 색 텍스트 한 줄 + 그 아래 textarea. 카드나 모달로 감싸지 마라. 실패는 흐름의 한 갈래이지 사고가 아니다.

## 레이아웃

- 전체 너비: `max-w-5xl`
- 3분할: `lg:grid-cols-3 gap-4`. `lg` 미만에서는 세로로 쌓되 **안 쓴 것을 맨 위**에 둔다
- 정렬: 좌측 정렬 기본. 중앙 정렬은 빈 상태(idle) 화면에도 쓰지 않는다
- 간격: 카드 사이 `gap-2`, 섹션 사이 `space-y-8`

## 타이포그래피

시스템 폰트를 쓴다. 웹폰트를 불러오지 않는다.

| 용도 | 스타일 |
|------|--------|
| 페이지 제목 | `text-xl font-semibold text-neutral-100` — 크게 만들지 마라 |
| 칸 제목 | `text-sm font-medium text-neutral-400` + 개수 `text-neutral-600` |
| 요구사항 문구 | `text-sm text-neutral-200` |
| 근거 원문 | `text-sm text-neutral-300 leading-relaxed` |
| 제안 문구 | `text-sm text-neutral-200` |
| 메타 (소속·신뢰도·기간) | `text-xs text-neutral-500` |

## 애니메이션

- 결과 등장: `fade-in 0.2s`
- 근거 펼치기: 없음. 즉시 나타난다
- 로딩: 1.5px stroke 원형 스피너 하나. 글로우·펄스·스켈레톤 금지
- **그 외 모든 애니메이션 금지**

## 아이콘

- SVG 인라인, `strokeWidth 1.5`
- 아이콘 컨테이너(둥근 배경 박스)로 감싸지 않는다
- 쓰는 곳은 복사 버튼과 펼침 화살표 둘뿐이다. 칸 제목에 아이콘을 붙이지 마라

## 고지 문구

첫 분석 전에 입력창 아래 `text-xs text-neutral-500` 한 줄로 둔다.

> 분석 시 Notion 이력서 원문과 공고 본문이 OpenAI API로 전송됩니다.

모달로 띄우지 않고 동의 버튼을 두지 않는다. 사용자가 나 하나이므로 알림이면 충분하다.
