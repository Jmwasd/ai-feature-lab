# UI 디자인 가이드

**원본:** https://claude.ai/code/artifact/3eb7a374-6180-4b94-8d9c-48fc51e8864c

이 문서는 위 디자인 목업(랜딩 + 리포트 2화면)에서 뽑아낸 스펙이다. 값이 목업과 다르면 **목업이 옳다.** 판단이 필요한 상황이 생기면 추측하지 말고 목업을 열어 확인하라.

## 디자인 원칙

1. **숫자가 주인공이다.** 금액·비율은 전부 JetBrains Mono, `font-weight:500`, 음수 letter-spacing으로 크게 찍는다. 장식이 숫자보다 시선을 먼저 끌면 실패다.
2. **다크 서피스는 "발견"에만 쓴다.** 랜딩 히어로와 반복 결제 카드만 `#0a0b0d`다. 다크는 테마가 아니라 **강조 수단**이다. 아무 카드나 검게 만들지 마라.
3. **포인트 색은 `#0052ff` 하나뿐이다.** 나머지는 전부 무채색 램프다. 파란색이 찍힌 곳이 이 화면에서 가장 중요한 숫자다.
4. **모르는 것은 모른다고 쓴다.** "미분류"를 회색으로 흐려 숨기지 마라. 본문 크기로 적고 사용자가 고칠 수 있는 자리를 준다.

## 안티패턴 — 하지 마라

| 금지 사항 | 이유 |
|-----------|------|
| backdrop-filter: blur() | glass morphism은 AI 템플릿의 가장 흔한 징후. 목업에 없다 |
| gradient-text, 배경 gradient orb | AI가 만든 SaaS 랜딩의 1번 특징. 목업은 전부 단색이다 |
| box-shadow 글로우 애니메이션 | 목업의 그림자는 `0 24px 60px rgba(0,0,0,0.45)` 하나뿐이다 (히어로 카드) |
| 보라/인디고 브랜드 색상 | 브랜드 색은 `#0052ff` 고정 |
| 카테고리 파이차트 | 회고형 표현. 목업은 가로 바만 쓴다 (PRD 참조) |
| 숫자 카운트업 애니메이션 | 사용자 보정 후 값 변화는 즉시 보여야 한다 |
| 이모지 아이콘 (💰 📊 🎉) | 금융 문서의 톤이 아니다. 목업의 아이콘은 `↑` 하나뿐이다 |
| "Powered by AI" 배지 | 기능이 아니라 장식 |

## 색상

```
브랜드
  --blue           #0052ff   포인트. 화면당 2~3곳만
  --blue-hover     #003ecc   링크 hover

잉크 / 다크 서피스
  --ink            #0a0b0d   본문 텍스트 · 다크 서피스 배경
  --surface-dark   #16181c   다크 위에 올리는 카드 · 배지
  --line-dark      #2a2d33   다크 위 구분선 · 비강조 바

무채색 램프 (밝은 배경)
  --text-body      #5b616e   본문 보조
  --text-muted     #7c828a   라벨 · 캡션
  --text-on-dark   #a8acb3   다크 위 보조 텍스트
  --ramp-6         #c9cdd3   차트 최하위
  --border         #dee1e6   카드 테두리
  --fill-subtle    #eef0f3   배지 배경 · 내부 구분선 · 바 트랙
  --fill-quiet     #f7f7f7   푸터 노트 배경 · 카테고리 바 트랙
  --bg             #ffffff   페이지
```

Tailwind에 이 이름 그대로 등록하고, 컴포넌트에서 임의 hex(`bg-[#0052ff]`)를 쓰지 마라.

```ts
// tailwind.config.ts
colors: {
  blue: { DEFAULT: '#0052ff', hover: '#003ecc' },
  ink: '#0a0b0d',
  surface: { dark: '#16181c' },
  line: { dark: '#2a2d33', DEFAULT: '#dee1e6' },
  fill: { subtle: '#eef0f3', quiet: '#f7f7f7' },
  text: { body: '#5b616e', muted: '#7c828a', ondark: '#a8acb3' },
  ramp: '#c9cdd3',
}
```

### 카테고리 바 색상 (순서 고정)

상위부터 이 순서로 배정한다. 색이 순위를 나타내므로 임의로 섞지 마라.

```
1위 #0052ff   2위 #0a0b0d   3위 #2a2d33   4위 #5b616e
5위 #7c828a   6위 #a8acb3   7위 #c9cdd3
```

## 타이포그래피

`next/font/google`로 두 벌만 로드한다. 다른 폰트를 추가하지 마라.

- **Inter** — 400 / 500 / 600. 모든 텍스트
- **JetBrains Mono** — 500. **금액·비율·건수·순번 전용**

```
body { font-family: Inter, -apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
       -webkit-font-smoothing: antialiased; }
```

### 스케일

| 용도 | 크기 / 자간 / 굵기 | 폰트 |
|------|------|------|
| 랜딩 히어로 h1 | 60px / -1.6px / 400, line-height 1.02 | Inter |
| 리포트 h1 | 52px / -1.3px / 400 | Inter |
| 섹션 h2 | 36px / -0.5px / 400 | Inter |
| 다크 발견 카드 제목 | 24px / 600 | Inter |
| 발견 카드 제목 | 20px / 600 | Inter |
| 카드 소제목 | 18px / 600 | Inter |
| 히어로 본문 | 18px / line-height 1.55 | Inter |
| 본문 | 15~16px / line-height 1.5~1.55 | Inter |
| 표 행 · 라벨 | 14~15px | Inter |
| 캡션 · 각주 | 12~13px | Inter |
| 배지 (eyebrow) | 11~12px / +0.4px / 600 / uppercase | Inter |

**제목은 400이다.** 큰 글자를 굵게 만들지 마라 — 크기와 음수 자간이 이미 위계를 만든다. 600은 18~24px 구간에서만 쓴다.

### 숫자 스케일 (JetBrains Mono, weight 500)

| 자리 | 크기 / 자간 |
|------|------|
| 히어로 강조 비율 | 52px / -1.5px, line-height 1 |
| 미분류 비율 | 44px / -1.5px |
| 요약 스트립 | 40px / -1.5px |
| 발견 카드 금액 | 36px / -1px |
| 월/연 대비 금액 | 32px / -1px |
| 표 행 금액 | 14~15px |
| 순번 (01, 02) | 13px, `--text-muted` |

**통화는 `₩` 접두 + 천 단위 쉼표.** `₩122,390` 형식이다. `원` 접미를 쓰지 마라.
비율은 소수점 없이 정수 `%`로 반올림한다 (`27%`).

## 컴포넌트

### 배지 (eyebrow)

```
밝은 배경: bg #eef0f3 / text #0a0b0d
다크 배경: bg #16181c / text #ffffff
공통: 11~12px, weight 600, uppercase, letter-spacing 0.4px,
      padding 4px 10px (소) · 6px 12px (대), border-radius 100px
```

### 버튼

전부 `border-radius: 100px`. 사각 버튼을 만들지 마라.

```
Primary   bg #0052ff / #fff / 15~16px 600 / padding 12px 20px (소) · 16px 32px (대)
Dark      bg #0a0b0d / #fff / 15px 600 / padding 14px 26px
Secondary bg #eef0f3 / #0a0b0d / 15px 600 / padding 12px 20px
Toggle    선택됨: bg #0052ff 또는 #0a0b0d / #fff
          해제됨: bg #eef0f3 / #7c828a
          13px 600 / padding 7px 13px
```

### 카드

```
기본     border 1px #dee1e6 / border-radius 24px / padding 32px
큰 카드  padding 40px  (다크 발견 카드, 카테고리 섹션)
다크     bg #0a0b0d / color #fff / border 없음 / border-radius 24px / padding 40px
내부 리스트 컨테이너  border-radius 16px / overflow hidden
```

라운딩은 **24px로 통일**한다. 목업이 그렇게 되어 있다. 크기별로 다른 반경을 쓰지 마라.

### 요약 스트립

3칸 그리드 `1.4fr 1fr 1fr`를 테두리 하나로 감싼다. 카드 3장으로 쪼개지 마라.

```
border 1px #dee1e6 / border-radius 24px / overflow hidden / gap 0
칸 사이 구분: border-right 1px #eef0f3 (마지막 칸 제외)
칸 padding 28px 32px
라벨 13px #7c828a → 숫자 40px mono (margin-top 6px)
```

### 가로 바

파이차트 대신 이것만 쓴다.

```
트랙   height 8px (집중도) · 10px (카테고리) / bg #eef0f3 · #f7f7f7 / border-radius 100px
채움   위 카테고리 색상 / border-radius 100px / width = 비율%
라벨   좌측 이름 14~16px 600 / 우측 "₩금액 · NN%" mono 13~15px #5b616e
```

### 리스트 행

```
밝은 배경  padding 16px 20px / border-bottom 1px #eef0f3
다크 배경  padding 16px 20px / border-bottom 1px #0a0b0d
표 형태    padding 11px 0 / border-bottom 1px #eef0f3
아바타 자리 32px 원 (#2a2d33) — 로고를 넣지 말고 원만 둔다
```

### 업로드 드롭존 (랜딩, 다크 위)

```
border 1.5px dashed #2a2d33 / border-radius 24px / padding 28px / bg #16181c
아이콘 52px 정사각 / border-radius 14px / bg #0a0b0d / 내용 "↑"
제목 16px 600 · 설명 13px #a8acb3
우측 Primary 버튼 "파일 선택"
```

## 레이아웃

- **컨테이너 폭 1000px**, 좌우 padding 24px. `max-w-3xl` 같은 좁은 폭을 쓰지 마라
- 상단 네비: height 64px, sticky, `border-bottom 1px #dee1e6`, bg #ffffff
- 랜딩 히어로: grid `1.05fr 0.95fr`, gap 56px, min-height 600px, 좌측 padding 80px 0
- 랜딩 하단 섹션: padding 96px 24px
- 리포트 본문: padding 56px 24px 96px
- 섹션 제목 블록: `margin 72px 0 24px`, 좌측에 13px 600 #7c828a 라벨 + h2 나란히 (baseline 정렬)
- 카드 그리드: 2열 `1fr 1fr`, gap 24px
- 좌측 정렬 기본. 숫자 열만 우측 정렬. 중앙 정렬 금지

## 화면 구성

### 1. 랜딩 (`isLanding`)

```
다크 히어로 (#0a0b0d)
  좌: 배지 → h1 60px → 설명 18px → 드롭존 → "샘플 리포트 열어보기" 링크
  우: 겹친 카드 2장 (#16181c) — 뒤 카드 rotate(4deg), 앞 카드에 52px 파란 비율 + 6칸 막대
밝은 섹션
  h2 "은행 앱이 말해주지 않는 것" → 2×2 카드 (01~04 순번 + 제목 + 설명)
  하단 Primary 버튼 (대)
```

### 2. 리포트 (`isReport`)

```
헤더        배지 2개 → "계좌 · 기간" 13px → h1 52px | 우측 [다시 업로드] [PDF로 내보내기]
요약 스트립  총 지출 / 거래 건수 / 자동 제외된 취소  + 아래 13px 각주
발견 (h2 "네 가지 사실")
  1  반복 결제    다크 카드 · 좌 텍스트 + "월 → 연간" 대비 / 우 구독 리스트
  2  이벤트 묶음  밝은 카드 · 총액 36px + 항목 리스트          ┐ 2열
  3  지출 집중도  밝은 카드 · 파란 비율 36px + 상위 3개 바     ┘
  4  미분류 비중  밝은 카드 전폭 · 좌 비율 44px / 우 보정 가능한 행 리스트
분류 (h2 "카테고리별 소비")
  전폭 카드 · 카테고리 바 목록 + 하단 분류 규칙 각주
푸터 노트   bg #f7f7f7 / radius 24px / "저장되지 않습니다" + Dark 버튼
```

발견이 카테고리별 지출보다 **위**에 온다. 순서를 바꾸지 마라.

## 인터랙션

- 미분류 행의 `[소비] [소비 아님]` 토글 → 총 지출·집중도·미분류 비율이 **즉시 재집계**된다. 재업로드 없이 클라이언트 상태로 처리한다
- "소비 아님"으로 표시된 행: 태그가 `미분류`(bg #0a0b0d) → `제외됨`(bg #eef0f3 / text #7c828a)으로 바뀐다
- 상단 로고 클릭 → 랜딩으로 리셋

## 인쇄

```css
@media print {
  .no-print { display: none !important; }
}
```

`no-print` 대상: 상단 네비 전체, 헤더의 [다시 업로드]·[PDF로 내보내기], 미분류 행의 토글 버튼, 푸터의 인쇄 버튼.
**사용자가 지정한 값 자체는 인쇄돼야 한다** — 태그(`미분류`/`제외됨`)는 남기고 버튼만 숨긴다.

> **미결정 — 구현 전에 확인할 것:** 목업의 인쇄 규칙은 위 한 줄이 전부다. 그런데 랜딩 히어로와 반복 결제 카드는 `#0a0b0d` 배경에 흰 텍스트라, 브라우저 기본 동작(배경색 미인쇄)에서는 **흰 종이에 흰 글씨가 찍혀 내용이 사라진다.** `print-color-adjust: exact`를 켜거나 인쇄 시 라이트로 반전하는 규칙이 필요하다. 목업에 답이 없으므로 임의로 정하지 마라.

## 애니메이션

- 리포트 최초 표시 시 fade-in 0.2s 1회
- 그 외 없음. 특히 숫자 변화 트랜지션 금지 — 보정 결과는 즉시 보여야 한다

## 아이콘

- 목업에 아이콘이 사실상 없다. 업로드 화살표 `↑`와 대비 화살표 `→`는 **텍스트 문자**다
- 아이콘 라이브러리를 추가하지 마라
- 꼭 필요하면 SVG 인라인, `strokeWidth 1.5`, `currentColor`. 둥근 배경 박스로 감싸지 않는다
