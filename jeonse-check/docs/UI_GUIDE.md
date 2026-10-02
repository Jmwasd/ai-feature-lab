# UI 디자인 가이드

> jeonse-check 디자인 **규칙**의 단일 원본이다. 다른 문서나 step 파일에 복제하지 말고 경로만 참조한다.
> **토큰 값**(색·크기·간격·라운드·그림자·브레이크포인트·이징)의 단일 원본은 `src/app/globals.css`의 Tailwind v4 `@theme`이다. 이 문서에는 값을 다시 적지 않는다.
> 원본 시안: 디자인 시스템(https://claude.ai/artifact/HnmmuWpPPS5DJCRrhAkYTP), 랜딩(https://claude.ai/artifact/3EP7P5ZJFUxTFtwqNVXemn). 시안 문구가 `CLAUDE.md`와 충돌하면 **`CLAUDE.md`가 우선**한다(§6).
> UI 작업 절차는 `.claude/skills/jeonse-design/SKILL.md`를 따른다.

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
- 임의값(`text-[15px]`, `bg-[#…]`)을 쓰지 마라. 예외는 이 문서에 적힌 레이아웃 치수(`w-[280px]`, `grid-cols-[72px_1fr_56px]`, 막대 두께, 랜딩 시안의 히어로 카드 여백·스크롤 안내 마우스·미리보기 판 패딩 등)뿐이다.
- 인라인 style이나 CSS 모듈에서는 같은 이름의 CSS 변수(`var(--color-ink)`, `var(--text-body-sm)`)를 쓴다.
- 금액·비율에는 `tabular-nums`를 준다.
- 클릭할 수 있는 요소(버튼·탭·링크·슬라이더)는 `cursor: pointer`다. `globals.css` base가 전역으로 주므로 컴포넌트에 따로 쓰지 않는다.

### 컬러 용도

`text-`·`bg-`·`border-` 뒤에 붙여 쓴다(예: `border-hairline`, `border-border-strong`).

| 색 이름 | 용도 |
|---|---|
| `primary` | 주요 CTA, 검색 오브, 워드마크, 히어로 강조 어절·상태 점 |
| `primary-active` / `primary-disabled` | CTA 누름 / 비활성 |
| `canvas` | 모든 페이지 배경. 어두운 섹션·대비색 푸터를 두지 않는다 |
| `surface-soft` / `surface-strong` | 호버·비활성 필드·미리보기 판 / 원형 아이콘 버튼·막대 트랙 |
| `hairline` / `hairline-soft` / `border-strong` | 기본 1px 테두리 / 섹션·행 구분선 / 비활성 외곽선·기준선 |
| `ink` / `body` / `muted` / `muted-soft` | 헤드라인·수치 / 긴 본문 / 보조 라벨·캡션 / 비활성 |
| `error-text` | 폼 오류, **위험** 수준 신호 |
| `legal-link` | 면책·법률 문구 안의 링크 전용 |
| `scrim` | 모달 배경 전용 |

### 타이포 용도 (`text-*`)

| 클래스 | 용도 |
|---|---|
| `text-hero` / `text-lead` | 랜딩 히어로 h1 / 히어로 리드 문단 |
| `text-rating-display` | 결과 화면의 **위험 신호 개수** 숫자 |
| `text-ratio-display` | 비율 막대의 큰 퍼센트 |
| `text-display-xl` | 랜딩 밖 페이지 최상위 헤드라인, 종합 판정의 비율 수치 |
| `text-display-lg` | 워드마크, 조회한 주소 |
| `text-display-md` | 섹션 제목 |
| `text-display-sm` | 결과 헤드라인 "위험 신호 N개" |
| `text-title-md` / `text-title-sm` | 카드·항목 제목, 요약 수치 / 푸터 열 제목 |
| `text-body-md` / `text-body-sm` | 본문·입력값 / 보조 본문·메타(면적·층) |
| `text-caption` / `text-caption-sm` | 필드 라벨·내비 / 출처·데이터 기준일·저작권 |
| `text-badge`, `text-button-md`, `text-button-sm` | 배지, 버튼 |

## 3. 레이아웃

- 콘텐츠 폭은 `max-w-editorial`(랜딩·결과) 또는 `max-w-detail`, 좌우 거터는 `px-gutter`(모든 폭 동일)다.
- 섹션은 `py-section px-gutter` + 상단 1px `hairline-soft`로 나눈다.
- 두 칼럼 섹션은 `grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))]` + `gap-xxl`로 두고, 좁은 폭에서 자연히 1열이 되게 한다.
- 반응형은 모바일이 기본이고 `tablet:`·`desktop:`·`wide:`로 넓혀 간다. 행 순서를 바꾸지 않고 열 수만 늘린다.
  - 기본(`tablet` 미만): 내비는 햄버거 메뉴, 주요 CTA는 하단 고정 바
  - `desktop:` 이상: 전체 내비. 결과 화면은 2단(본문 / `gap-xl` / 우측 레일)
  - `wide:` 이상: 콘텐츠는 최대 폭에 멈추고 여백이 나머지를 흡수

## 4. 컴포넌트

표현 컴포넌트는 `src/components/`에, 도메인 문구를 조합하는 컴포넌트는 `src/features/*`나 라우트 `_components/`에 둔다(ARCHITECTURE.md). 아이콘은 `lucide-react`(currentColor)를 쓴다.

| 컴포넌트 | 용도 | 사양 |
|---|---|---|
| `Button` | CTA, 저장, 더 보기 | `min-h-control`, `px-lg`, `rounded-button`, `text-button-md`. 변형: `primary`(레드), `secondary`(흰 바탕 + 1px 잉크 테두리), `tertiary-text`(밑줄, 패딩 0), `pill-primary`(`rounded-full`, `text-button-sm`). 누름 `primary-active`, 비활성 `primary-disabled`. 전환은 배경·글자색만 |
| `TextInput` | 주소, 보증금, 면적, 채권최고액 | 라벨이 필드 안 위에 쌓인다. `h-input`, `rounded-input`, 1px `hairline`. 라벨 `text-caption text-muted`, 값 `text-body-md`. **포커스는 2px 잉크 테두리만**(glow·ring 없음, 크기 유지). 오류는 테두리와 아래 문구를 `error-text`로. 비활성 `bg-surface-soft` |
| `SearchBarPill` | 조회 입력(주소 · 보증금 · 전용면적) | `h-search`, `rounded-full`, 1px `hairline` + `shadow-float`. 세그먼트 사이 1px `hairline`, 활성 세그먼트는 `surface-soft` 알약. 오른쪽 끝에 레드 원형 오브 |
| `TopNav` | 전역 상단 바 | `h-nav`, sticky, 하단 1px `hairline`, 폭 제한 없이 `px-gutter`. **스크롤 8px 초과 시 `shadow-float`**. 왼쪽 `house` 아이콘 + 워드마크(`text-display-lg text-primary`). 가운데 내비 링크 `text-button-md text-body` + 16px 아이콘, 알약 호버 `bg-surface-soft`. 오른쪽 `secondary` 버튼(비로그인 "로그인") |
| `SignalSummary` | 결과 최상단 요약 | 가운데 정렬 세로 스택. `text-rating-display` = **위험 신호 개수**, 아래 `text-display-sm` "위험 신호 N개", `text-body-sm text-muted` 캡션, 요약 수치 줄(`text-title-md` 값 + `text-caption-sm` 라벨) |
| `CheckList` | 확인한 항목 | 제목 `text-display-md`, 위아래 1px `hairline`로 닫힌 목록, 행마다 24px 아이콘 + `text-body-md`. 확인 못 한 항목은 `muted-soft` + 취소선 |
| 상태 배지 | 신호 수준 | 흰 알약, `text-badge`, `shadow-float` |
| `IconButtonCircle` | 뒤로 가기, 닫기 | 32px 원, `bg-surface-strong` + 1px `hairline` |
| `FooterLight` | 전역 푸터 | 흰 바탕, 상단 1px `hairline`, `px-section py-xxl`. 열 수만큼 같은 폭 그리드. 열 제목 `text-title-sm`, 링크 `text-body-sm text-ink`. 하단 법률 밴드(상단 1px `hairline`) `text-caption-sm text-muted`. 없는 페이지 링크는 두지 않는다 |

랜딩 시안 패턴:

| 패턴 | 사양 |
|---|---|
| 상태 알약 | `rounded-full bg-surface-soft` + 1px `hairline-soft`, `text-caption`. 앞에 14px 레드 아이콘을 둘 수 있다 |
| 떠 있는 신호 카드 | `w-[280px] rounded-card shadow-float`, `animate-float`. 36px 레드 원 + 흰 `triangle-alert`, 라벨 "전세 위험도" + 값 "높음"(`text-error-text`), 6px 레드 게이지(마운트 뒤 0→86%), 예시 신호 줄(레드 `circle-alert` + `text-body-sm`). **랜딩 히어로의 예시 일러스트 전용이다.** 이 라벨·게이지·아이콘 조합을 결과 화면이나 실제 판정에 쓰지 않는다(§6) |
| 비율 막대 | 왼쪽 아이콘 + 라벨 `text-title-md`, 오른쪽에 상태 `text-caption` 굵게 + 값 `text-ratio-display`. 트랙 10px `rounded-full bg-surface-strong`. 값이 위험 임계치 이상이면 `error-text`로 채우고, 미만이면 `ink`로 채운다. **위험 임계치 위치에 1px `muted` 기준선**. 아래 계산식과 "80% 기준"(`text-caption-sm text-muted`). 트랙 최대 120% |
| 비교 막대 | `grid-cols-[72px_1fr_56px]`, 트랙 28px `rounded-sm bg-surface-soft`, 기준선 `border-strong` |
| 슬라이더 | 라벨 `text-caption`과 현재 값 `text-title-md`를 양끝에, 아래 `input[type=range]` |
| 프리셋 칩 | 높이 40px, `rounded-full`, 1px `hairline`, `text-caption`. 호버 시 `surface-soft` + 잉크 테두리 |
| 선택 탭 | 높이 44px, `rounded-full`, `text-button-sm`. 선택된 탭은 잉크 배경 + 흰 글자, 나머지는 흰 배경 + 1px `hairline`. 가로 스크롤 허용 |
| 세그먼트 토글 | 바깥 1px `hairline` `rounded-full` p-0.5, 선택된 항목만 잉크 배경 + 흰 글자 |
| 단계 진행 탭 | 가로 3열. 3px 진행 막대(트랙 `surface-strong`, 채움 `primary-disabled`→`primary` 그라디언트, 100ms 간격 linear 전환으로 부드럽게) + 아이콘·`text-title-md` 제목 + `text-body-sm text-muted` 설명. 현재 단계만 잉크 |
| 미리보기 판 | `bg-surface-soft rounded-card` 안에 흰 카드(최대 520px, `shadow-float`). 입력 화면을 흉내 낸 예시이며 금액·비율은 "계산해 보기" 예시 집 값으로 맞춘다 |
| 신호 행 | 상단 1px `hairline-soft`, 20px 아이콘 + `text-title-md` 제목 + `text-body-sm text-body` 설명 |
| 예/아니오 선택 | 버튼 모양, `rounded-sm`, `text-button-sm`. 선택된 쪽만 2px 잉크 테두리 |

시안의 `ListingCard`, `ListingPhoto`, `ExperienceCard`, `ReviewsCard`, `HostCard`, `ReservationCard`, `DateRangeCalendar`는 쓰지 않는다. 이유: MVP에 매물 사진·리뷰·임대인 정보·결제·날짜 범위 선택이 없다.

## 5. 모션

모든 페이지에서 허용한다. 이징은 `ease-fade`(opacity·blur), `ease-rise`(transform), `ease-fill`(막대 채움)을 쓴다.

| 이름 | 사양 |
|---|---|
| 등장 | opacity 0→1, translateY 16px→0, blur 6px→0. 약 1.1–1.3s, 요소별 0–400ms 계단 지연, 뷰포트 15% 진입 시 한 번 |
| 헤드라인 롤링 | 랜딩 h1의 두 줄짜리 문장 4개를 3s마다 교체. 들어오는 문장은 아래(14px)에서, 나가는 문장은 위(-10px)로 blur 8px과 함께 움직이고, 두 줄이 350·650ms(나갈 때 0·120ms) 차이로 따라온다. `aria-live="polite"`, 숨은 문장은 `aria-hidden` |
| 내용 교체 | 340ms 페이드아웃(+8–10px, blur) 뒤 교체. 다시 나타날 때 패널 380–480ms 페이드 + 560–720ms 이동, 목록 행은 90–110ms씩 지연 |
| 숫자 트윈 / 막대 채움 | 목표값까지 부드럽게 접근(랜딩은 섹션 진입 시 0부터, 프레임마다 남은 거리의 7%) / width 1.2s `ease-fill` |
| 떠 있기 | `animate-float` (히어로 카드) |
| 히어로 배경 | 로드 시 scale 1.06→1(1.4s), 이후 스크롤 패럴랙스(600px까지 translateY 8%) |
| 스크롤 안내 | 히어로 하단 마우스 모양 안의 휠이 `animate-wheel`로 내려간다 |

- `prefers-reduced-motion`이면 모두 끈다(`globals.css` base에 전역 처리가 있다. JS 모션도 같은 조건을 확인한다).
- 면책 문구, 데이터 기준일, 출처에는 등장 모션을 주지 않는다. 이유: 관찰자가 실패해 숨겨지면 CLAUDE.md 필수 표시를 어긴다.
- 모션은 `transform`, `opacity`, `filter`, `width`에만 준다.

## 6. jeonse-check 전용 규칙 (CLAUDE.md 우선)

| 시안 표현 | 이유 | 대체 |
|---|---|---|
| "안전 점수 82" | "안전" 단정 금지, 점수화 | 큰 숫자는 위험 신호 **개수**만. "위험 신호 N개"(0개 포함) |
| "안전한 빌라", "안전한 조건" | "안전" 단정 금지 | "비율이 낮은 빌라", "보증금이 낮을 때" |
| 상태 "안정", 배지 "위험 낮음" | 안전을 암시한다 | 상태는 비우거나 "70% 미만"처럼 기준 대비 사실로 쓴다. 배지는 "주의" / "위험"만 둔다 |
| "발견된 위험 신호 없음" | 헤드라인 형식 불일치 | "위험 신호 0개" + 계약 당일 등기부 재확인 안내 |
| HUG "가입 가능성 높음" | 심사 결과를 보장하는 것처럼 읽힌다 | "가입 기준 충족(공시가격 기준 추정)" / "가입 어려움" |
| "매우 위험" (100% 이상) | 수준은 `policy.ts`의 두 단계뿐이다 | "위험". 수치를 크게 보여 심각도를 전한다 |
| "선순위 근저당이 없습니다" 같은 단정 | 입력에 의존하는 사실 | "입력한 등기부 기준 근저당 0원"처럼 근거를 붙인다 |
| 세금 체납·전입세대·임대인 리포트·등기부 자동 조회, 오피스텔, 결제 | MVP 제외(PRD) | 쓰지 않는다. 권리관계는 "사용자 입력(등기부 기준)"으로 표기한다 |

- **금지 표현** (화면·문구 전체, 판정 문구 테스트의 기준 목록): "안전", "안정", "양호", "문제없음", "괜찮", "위험 낮음". 이 목록은 여기에만 둔다.
- 예외: 랜딩 히어로의 떠 있는 신호 카드("전세 위험도 높음" + 게이지)는 시안 그대로 둔다. 예시 일러스트이며 실제 판정 결과가 아니다.
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
- 두 번째 그림자 단계, 그라디언트, 글래스모피즘, 어두운 배경 섹션을 만들지 마라. 예외: 랜딩 "단계 진행 탭" 진행 막대의 레드 그라디언트(랜딩 시안).
- 입력 포커스에 glow·ring을 쓰지 마라. 2px 잉크 테두리만 쓴다.
- 초록 체크·방패 체크로 "통과"를 표현하지 마라. 기준 충족 표시는 잉크색 `circle-check`만 쓴다. 이유: 안전 보장으로 읽힌다.
- 신호등 3색(초록·노랑·빨강)을 쓰지 마라.

## 8. 랜딩 페이지 구성

`src/app/page.tsx`의 섹션 순서:

1. **TopNav** — 앵커 링크: 계산해 보기 · 사례 · 이용 방법 · 데이터 출처. 비로그인이면 "로그인"(secondary, Google 로그인)
2. **히어로** — 최소 높이 `max(640px, 100vh - 80px)`, 배경 `docs/assets/landing-hero.png`(구현 시 `public/images/`로 옮기고 WebP 변환). 순서: 상태 알약 → 롤링 헤드라인 → 리드 → CTA 두 개(primary "지금 위험도 확인하기" + 외곽선 "이용 방법 보기"). 오른쪽에 떠 있는 신호 카드, 하단에 "아래로 스크롤" 안내
3. **계산해 보기** `#try` — 보증금·근저당 슬라이더와 프리셋 칩, 오른쪽 카드에 비율 막대 2개 + HUG 줄. 계산은 `src/features/judgment/` 함수를 그대로 쓴다
4. **사례** `#cases` — 선택 탭 5개(비율이 낮은 빌라, 깡통전세, 근저당 과다, 신탁 등기, 근린생활시설), 처음엔 깡통전세. 왼쪽은 주소·조건 요약 + 비교 막대 + HUG 줄, 오른쪽은 "위험 신호 N개" + 신호 행. "예시 데이터" 표기. 신호 문구는 랜딩 예시 문구(`cases-data.ts`)이고 결과 화면 문구(`copy.ts`)와 따로 둔다
5. **이용 방법** `#flow` — 단계 진행 탭 3개(4.5s 자동 진행) + 미리보기 판
6. **데이터 출처** `#sources` — 기관 카드 5개(로고는 `public/images/sources/`, 없으면 아이콘) + 세그먼트 토글(자동 조회 / 직접 입력 / 지원 안 함). "지원 안 함"은 PRD의 MVP 제외 사항
7. **마지막 CTA** — "계약 전에 확인하세요" + primary 버튼 + 면책 문구
8. **FooterLight** — 서비스(위험 진단 · 저장한 결과) / jeonse-check(데이터 출처) 열, "© 2026 jeonse-check"
