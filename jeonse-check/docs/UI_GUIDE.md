# UI 디자인 가이드

> jeonse-check 디자인 **규칙**의 단일 원본이다. 다른 문서나 step 파일에 복제하지 말고 경로만 참조한다.
> **토큰 값**(색·크기·간격·라운드·그림자·브레이크포인트·이징)의 단일 원본은 `src/app/globals.css`의 Tailwind v4 `@theme`이다. 이 문서에는 값을 다시 적지 않는다.
> 원본 시안: 디자인 시스템(https://claude.ai/artifact/HnmmuWpPPS5DJCRrhAkYTP). 시안 문구가 `CLAUDE.md`와 충돌하면 **`CLAUDE.md`가 우선**한다(§6).
> UI 작업 절차는 `.claude/skills/jeonse-design/SKILL.md`를 따른다. 랜딩 페이지(`src/app/page.tsx`, `src/app/_components/`)는 구현이 끝났으므로 그 코드가 곧 사양이다.

## 1. 원칙

- 흰 캔버스와 거의 검은 잉크로 화면의 약 90%를 채운다. 레드(`primary`)는 강조에만 쓰고, **레드 CTA 버튼은 뷰포트당 1~2개**다.
- 숫자와 사실이 화면의 무게를 맡는다. 수치에는 계산식이나 근거를 붙인다.
- 모든 모서리는 둥글고, 그림자는 `shadow-float` 한 단계뿐이다. 나머지는 flat이다.
- 서체는 Pretendard 하나다(`next/font/local`로 셀프 호스팅, 변수 `--font-pretendard`).
- 문장은 해요체로 짧고 구체적으로 쓴다(예: "보증금이 추정 시세의 80%를 넘어요").

## 2. 토큰 사용

- 스타일은 `globals.css` `@theme`이 만드는 **Tailwind 유틸리티**로 쓴다. 예: `text-ink`, `bg-surface-soft`, `text-display-md`, `p-lg`, `rounded-card`, `shadow-float`, `max-w-editorial`, `desktop:`.
- 기본 팔레트·스케일은 비워 두었다. `bg-green-500`, `shadow-lg`, `text-sm` 같은 기본 클래스는 생성되지 않는다. 팔레트를 다시 열지 마라.
- **새 토큰을 만들지 않는다.** 필요한 값이 없으면 가장 가까운 기존 토큰을 쓴다(예: 15px 글자 → `text-body-sm`, 20px 간격 → `gap-gutter`). `globals.css`의 `@theme`은 사용자 지시가 있을 때만 바꾼다.
- 임의값(`text-[15px]`, `bg-[#…]`)을 쓰지 마라. 예외는 레이아웃 치수(막대 두께, 모달 패널 `max-w-[400px]`, 결과 우측 레일의 sticky 위치 등)뿐이다.
- 인라인 style이나 CSS 모듈에서는 같은 이름의 CSS 변수(`var(--color-ink)`, `var(--text-body-sm)`)를 쓴다.
- 금액·비율에는 `tabular-nums`를 준다.
- 클릭할 수 있는 요소는 `cursor: pointer`다. `globals.css` base가 전역으로 주므로 컴포넌트에 따로 쓰지 않는다.

### 컬러 용도

`text-`·`bg-`·`border-` 뒤에 붙여 쓴다(예: `border-hairline`, `border-border-strong`).

| 색 이름 | 용도 |
|---|---|
| `primary` | 주요 CTA, 검색 오브, 워드마크 |
| `primary-active` / `primary-disabled` | CTA 누름 / 비활성 |
| `canvas` | 모든 페이지 배경. 어두운 섹션·대비색 푸터를 두지 않는다 |
| `surface-soft` / `surface-strong` | 호버·비활성 필드·안내 상자 / 원형 아이콘 버튼·막대 트랙 |
| `hairline` / `hairline-soft` / `border-strong` | 기본 1px 테두리 / 섹션·행 구분선 / 비활성 외곽선·기준선 |
| `ink` / `body` / `muted` / `muted-soft` | 헤드라인·수치 / 긴 본문 / 보조 라벨·캡션 / 비활성 |
| `error-text` | 폼 오류, **위험** 수준 신호 |
| `legal-link` | 면책·법률 문구 안의 링크 전용 |
| `scrim` | 어두운 모달 배경용. 로그인 모달은 흰 막(`bg-canvas/70`)을 쓴다 |

### 타이포 용도 (`text-*`)

| 클래스 | 용도 |
|---|---|
| `text-rating-display` | 결과 화면의 **위험 신호 개수** 숫자 |
| `text-ratio-display` | 비율 막대의 큰 퍼센트 |
| `text-display-xl` | 페이지 최상위 헤드라인, 종합 판정의 비율 수치 |
| `text-display-lg` | 워드마크, 조회한 주소 |
| `text-display-md` | 섹션 제목 |
| `text-display-sm` | 결과 헤드라인 "위험 신호 N개", 모달 제목 |
| `text-title-md` / `text-title-sm` | 카드·항목 제목, 요약 수치 / 푸터 열 제목 |
| `text-body-md` / `text-body-sm` | 본문·입력값 / 보조 본문·메타(면적·층) |
| `text-caption` / `text-caption-sm` | 필드 라벨·내비 / 출처·데이터 기준일·저작권 |
| `text-badge`, `text-button-md`, `text-button-sm` | 배지, 버튼 |

## 3. 레이아웃

- 콘텐츠 폭은 `max-w-editorial` 또는 `max-w-detail`, 좌우 거터는 `px-gutter`(모든 폭 동일)다.
- 섹션은 `py-section px-gutter` + 상단 1px `hairline-soft`로 나눈다.
- 반응형은 모바일이 기본이고 `tablet:`·`desktop:`·`wide:`로 넓혀 간다. 행 순서를 바꾸지 않고 열 수만 늘린다.
  - 기본(`tablet` 미만): 내비는 햄버거 메뉴, 주요 CTA는 하단 고정 바
  - `desktop:` 이상: 전체 내비. 결과 화면은 2단(본문 / `gap-xl` / 우측 레일). 우측 레일은 `sticky`로 상단 바 아래(`top-[calc(var(--spacing-nav)+var(--spacing-lg))]`, `self-start`)에 붙어 따라온다
  - `wide:` 이상: 콘텐츠는 최대 폭에 멈추고 여백이 나머지를 흡수

## 4. 컴포넌트

표현 컴포넌트는 `src/components/`에, 도메인 문구를 조합하는 컴포넌트는 `src/features/*`나 라우트 `_components/`에 둔다(ARCHITECTURE.md). 아이콘은 `lucide-react`(currentColor)를 쓴다.

| 컴포넌트 | 용도 | 사양 |
|---|---|---|
| `Button` | CTA, 저장, 더 보기 | `min-h-control`, `px-lg`, `rounded-button`, `text-button-md`. 변형: `primary`(레드), `secondary`(흰 바탕 + 1px 잉크 테두리), `tertiary-text`(밑줄, 패딩 0), `pill-primary`(`rounded-full`, `text-button-sm`). 누름 `primary-active`, 비활성 `primary-disabled`. 전환은 배경·글자색만 |
| `TextInput` | 주소, 보증금, 면적, 채권최고액 | 라벨이 필드 안 위에 쌓인다. `h-input`, `rounded-input`, 1px `hairline`. 라벨 `text-caption text-muted`, 값 `text-body-md`. **포커스는 2px 잉크 테두리만**(glow·ring 없음, 크기 유지). 오류는 테두리와 아래 문구를 `error-text`로. 비활성 `bg-surface-soft` |
| `SearchBarPill` | 조회 입력(주소 · 보증금 · 전용면적) | `h-search`, `rounded-full`, 1px `hairline` + `shadow-float`. 세그먼트 사이 1px `hairline`, 활성 세그먼트는 `surface-soft` 알약. 오른쪽 끝에 레드 원형 오브 |
| `TopNav` | 전역 상단 바 | `h-nav`, sticky, 하단 1px `hairline`, 폭 제한 없이 `px-gutter`. **스크롤 8px 초과 시 `shadow-float`**. 왼쪽 `house` 아이콘 + 워드마크(`text-display-lg text-primary`). 가운데 내비 링크 `text-button-md text-body` + 16px 아이콘, 알약 호버 `bg-surface-soft`. 오른쪽 `secondary` 버튼(비로그인 "로그인" → 로그인 모달). 로그인 상태는 "내 조회"·"저장 목록"을 내비와 같은 알약 링크로 두고 끝에 `secondary` "로그아웃". `tablet` 미만에서는 계정 항목을 햄버거 메뉴 아래쪽으로 옮기고, 메뉴가 비면 햄버거를 두지 않는다 |
| `Modal` | 로그인 | 흰 막 `bg-canvas/70` 위 가운데 흰 패널 `w-full max-w-[400px] rounded-card p-lg shadow-float`. 닫기는 배경 없는 18px `x`(호버 시 `bg-surface-soft` 원). Esc·바깥 막·닫기로 닫고, 포커스를 패널 안에 가두었다가 닫으면 연 버튼으로 돌려준다. 열고 닫기 300ms(§5) |
| `SignalSummary` | 결과 최상단 요약 | 가운데 정렬 세로 스택. `text-rating-display` = **위험 신호 개수**, 아래 `text-display-sm` "위험 신호 N개", `text-body-sm text-muted` 캡션, 요약 수치 줄(`text-title-md` 값 + `text-caption-sm` 라벨) |
| 상태 배지 | 신호 수준 | 흰 알약, `text-badge`, `shadow-float` |
| `IconButtonCircle` | 뒤로 가기, 항목 삭제 | 32px 원, `bg-surface-strong` + 1px `hairline` |
| `FooterLight` | 전역 푸터 | 흰 바탕, 상단 1px `hairline`, `px-section py-xxl`. 열 제목 `text-title-sm`, 링크 `text-body-sm text-ink`. 하단 법률 밴드 `text-caption-sm text-muted`. 없는 페이지 링크는 두지 않는다 |

공통 패턴:

| 패턴 | 사양 |
|---|---|
| 비율 막대 | 왼쪽 라벨 `text-title-md`, 오른쪽에 상태 `text-caption` 굵게 + 값 `text-ratio-display`. 트랙 10px `rounded-full bg-surface-strong`. 위험 임계치 이상이면 `error-text`, 미만이면 `ink`로 채운다. **위험 임계치 위치에 1px `muted` 기준선**. 아래 계산식과 "80% 기준"(`text-caption-sm text-muted`). 트랙 최대 120% |
| 신호 행 | 상단 1px `hairline-soft`, 20px 아이콘 + `text-title-md` 제목 + `text-body-sm text-body` 설명 |
| 단계 진행 탭 | 가로 3열. 3px 진행 막대(트랙 `surface-strong`) + `text-title-md` 제목 + `text-body-sm text-muted` 설명. 현재 단계만 잉크 |
| 선택 탭 | 높이 44px, `rounded-full`, `text-button-sm`. 선택된 탭은 잉크 배경 + 흰 글자, 나머지는 흰 배경 + 1px `hairline`. 가로 스크롤 허용 |
| 예/아니오 선택 | 버튼 모양, `rounded-sm`, `text-button-sm`. 선택된 쪽만 2px 잉크 테두리 |
| 단계별 입력 | 입력 폼은 앞 칸이 유효해야 다음 칸을 열고, 모든 칸이 유효할 때만 다음·완료 버튼을 보인다. 한 번 열린 칸은 닫지 않는다. 고르는 동작으로 열린 칸에는 포커스를 옮긴다 |

## 5. 모션

이징은 `ease-fade`(opacity·blur), `ease-rise`(transform), `ease-fill`(막대 채움)을 쓴다.

| 이름 | 사양 |
|---|---|
| 등장 | opacity 0→1, translateY 16px→0, blur→0. 폼의 새 칸은 500ms(`Reveal`), 모달 패널은 300ms |
| 막대 채움 / 숫자 트윈 | width 1.2s `ease-fill` / 목표값까지 감속하며 다가간다 |

- `prefers-reduced-motion`이면 모두 끈다(`globals.css` base에 전역 처리가 있다. JS 모션도 같은 조건을 확인한다).
- 면책 문구, 데이터 기준일, 출처에는 등장 모션을 주지 않는다. 이유: 관찰자가 실패해 숨겨지면 CLAUDE.md 필수 표시를 어긴다.
- 모션은 `transform`(`translate`), `opacity`, `filter`, `width`에만 준다.

## 6. jeonse-check 전용 규칙 (CLAUDE.md 우선)

| 시안 표현 | 이유 | 대체 |
|---|---|---|
| "안전 점수 82" | "안전" 단정 금지, 점수화 | 큰 숫자는 위험 신호 **개수**만. "위험 신호 N개"(0개 포함) |
| 상태 "안정", 배지 "위험 낮음" | 안전을 암시한다 | 상태는 비우거나 "70% 미만"처럼 기준 대비 사실로 쓴다. 배지는 "주의" / "위험"만 둔다 |
| "발견된 위험 신호 없음" | 헤드라인 형식 불일치 | "위험 신호 0개" + 계약 당일 등기부 재확인 안내 |
| HUG "가입 가능성 높음" | 심사 결과를 보장하는 것처럼 읽힌다 | "가입 기준 충족(공시가격 기준 추정)" / "가입 어려움" |
| "매우 위험" (100% 이상) | 수준은 `policy.ts`의 두 단계뿐이다 | "위험". 수치를 크게 보여 심각도를 전한다 |
| "선순위 근저당이 없습니다" 같은 단정 | 입력에 의존하는 사실 | "입력한 등기부 기준 근저당 0원"처럼 근거를 붙인다 |
| 세금 체납·전입세대·임대인 리포트·등기부 자동 조회, 오피스텔, 결제 | MVP 제외(PRD) | 쓰지 않는다. 권리관계는 "사용자 입력(등기부 기준)"으로 표기한다 |

- **금지 표현** (화면·문구 전체, 판정 문구 테스트의 기준 목록): "안전", "안정", "양호", "문제없음", "괜찮", "위험 낮음". 이 목록은 여기에만 둔다.
- 예외: 랜딩 히어로의 떠 있는 신호 카드("전세 위험도 높음" + 게이지)는 예시 일러스트다. 이 조합을 결과 화면이나 실제 판정에 쓰지 않는다.
- 신호 수준: **위험**은 `triangle-alert` + `text-error-text`, **주의**는 `circle-alert` + `text-ink`로 표시한다. 색만으로 구분하지 말고 라벨을 함께 둔다.
- 임계치(70%·80%)와 HUG 비율(126%)은 화면 코드에 쓰지 않고 `src/consts/policy.ts`에서 가져온다. 기준선 위치와 "80% 기준" 문구도 마찬가지다.

결과 화면 필수 요소 (하나라도 빠지면 미완성):

1. `SignalSummary` — 위험 신호 개수, "위험 신호 N개"
2. 신호 목록 — 수준 배지, 제목, 근거 수치
3. 시세 추정 근거 — 방식, 신뢰도, 비교 거래 목록
4. 데이터 기준일과 출처(국토교통부 실거래가 · 공동주택 공시가격 · 건축물대장 · 사용자 입력) — `text-caption-sm text-muted`
5. 면책 문구 — 결과 영역 안에 `text-body-sm text-body`로, 접지 않는다. 문구 원본은 `src/features/judgment/copy.ts`

## 7. 금지 패턴

- 임의값·인라인 hex로 토큰을 우회하지 마라.
- 두 번째 그림자 단계, 그라디언트, 글래스모피즘, 어두운 배경 섹션을 만들지 마라. 예외: 랜딩 "이용 방법" 진행 막대의 레드 그라디언트.
- 입력 포커스에 glow·ring을 쓰지 마라. 2px 잉크 테두리만 쓴다.
- 초록 체크·방패 체크로 "통과"를 표현하지 마라. 기준 충족 표시는 잉크색 `circle-check`만 쓴다. 이유: 안전 보장으로 읽힌다.
- 신호등 3색(초록·노랑·빨강)을 쓰지 마라.
