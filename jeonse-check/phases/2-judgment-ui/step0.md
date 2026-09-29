# Step 0: result-components

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` ("위험 신호 N개", 면책 문구·데이터 기준일·출처 표시 CRITICAL)
- `/docs/ARCHITECTURE.md` (§3 결과 표시, feature 레이어 규칙)
- `/docs/UI_GUIDE.md` (전체. 특히 §4 `SignalSummary`·`CheckList`·상태 배지·신호 행·비교 막대, §6 결과 화면 필수 요소 5개, §7)
- `/.claude/skills/jeonse-design/SKILL.md`
- `/src/features/judgment/*` (`risk-report.ts`, `copy.ts`, `price-estimate.ts`, `ratios.ts`, `types.ts`)
- `/src/components/*`, `/src/utils/format.ts`, `/src/hooks/use-reveal.ts`, `/src/test/forbidden-phrases.ts` (phase 1)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

판정 결과를 props로 받아 그리는 결과 화면 컴포넌트를 만든다. 데이터를 불러오거나 페이지에 붙이지 않는다(phase 5에서 조립).

### 1. 뷰 모델 타입 (`src/features/judgment/ui/types.ts`)

```ts
export interface JudgmentView {
  address: { display: string; dong?: string; ho?: string };
  deposit: number;                          // 원
  exclusiveArea: number;                    // ㎡
  report: RiskReport;
  priceEstimate: PriceEstimate;
  jeonseRatio: RatioResult | null;
  debtRatio: RatioResult | null;
  hug: HugEligibility;
  priorityRepayment: { qualifies: boolean; amount: number } | null;
  rights: RightsInput;
}
```

### 2. 컴포넌트

도메인 타입을 아는 컴포넌트는 `src/features/judgment/ui/`에, 도메인과 무관한 표현 컴포넌트(예: 상태 배지)는 `src/components/`에 둔다(ARCHITECTURE §3).

```ts
export function ResultView(props: { view: JudgmentView }): JSX.Element;   // 아래를 조합한 결과 화면 본문
export function SignalSummary(props: { report: RiskReport; view: JudgmentView }): JSX.Element;
export function SignalList(props: { signals: RiskSignal[] }): JSX.Element;
export function RatioPanel(props: { view: JudgmentView }): JSX.Element;    // RatioBar 2개 + HUG 줄 + 최우선변제 줄
export function PriceEvidence(props: { estimate: PriceEstimate }): JSX.Element; // 방식, 신뢰도, 비교 거래 표, 조회 구간
export function ReportFooter(props: { report: RiskReport }): JSX.Element;  // 데이터 기준일, 출처, 면책 문구
```

- UI_GUIDE §6 **결과 화면 필수 요소 5개**를 `ResultView`가 모두 렌더링한다. 신호가 0개여도, 시세가 `none`이어도 빠지면 안 된다.
- 레이아웃: 모바일 1단, `desktop:` 이상 2단(본문 / 우측 레일에 `RatioPanel`). UI_GUIDE §3.
- 신호 수준 표시는 UI_GUIDE §6(위험 `triangle-alert` + `error-text`, 주의 `circle-alert` + `ink`, 라벨 함께).
- 신호 제목·설명, headline, notes, disclaimer, 출처명은 `report`와 `copy.ts`에서만 가져온다. 컴포넌트에서 판정 문구를 새로 쓰지 마라.
- HUG·최우선변제 줄 문구는 UI_GUIDE §6 대체 표현을 따른다. `"unknown"`이면 "입력이 부족해 판단할 수 없어요"처럼 사실만 쓴다. 이 줄 문구가 새로 필요하면 `copy.ts`에 추가하고 `risk-report.test.ts`의 금지 표현 검사 대상에 넣는다.
- 권리 입력 값은 "입력한 등기부 기준 근저당 0원"처럼 근거를 붙여 쓴다(UI_GUIDE §6).
- 비교 거래 표: 계약일, 전용면적, 층, 매매가(`formatWon`), 건물명. 해제 거래는 이미 제외돼 있다.
- `ReportFooter`에는 등장 모션을 주지 않는다(UI_GUIDE §5).
- 기준값(임계치, 126%)은 `policy.ts`에서 가져와 `RatioBar` props로 넘긴다.

### 3. 테스트용 fixture

- `src/features/judgment/ui/__fixtures__/views.ts`: 신호 0개, 모든 신호 발생, 시세 `none`, HUG `unknown` 네 가지 `JudgmentView`. 가능하면 `buildRiskReport` 등 실제 함수로 만든다.

### 4. 테스트 (`*.test.tsx`)

- fixture 4개 각각에서 필수 요소 5개가 모두 렌더링된다(면책 문구 전문, 데이터 기준일, 출처 4종, "위험 신호 N개", 시세 근거).
- 렌더링 텍스트에 금지 표현이 없다(`src/test/forbidden-phrases.ts`).
- 신호 수준 라벨이 색과 함께 텍스트로도 있다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
grep -rnE '\b(0\.7|0\.8|1\.26|70%|80%|126%)' src/features/judgment/ui --include='*.tsx' | grep -v '\.test\.tsx' || true   # 결과가 없어야 한다
```

## 금지사항

- 페이지(`src/app/check/...`)에 결과 화면을 붙이지 마라. 이유: 실제 데이터는 phase 5에서 연결한다. 제품 코드에서 fixture(mock)를 참조하면 ARCHITECTURE §2 위반이다.
- 점수·등급("안전 점수", "등급 A")을 만들지 마라. 이유: UI_GUIDE §6. 큰 숫자는 위험 신호 개수뿐이다.
- 면책 문구를 접기(accordion)나 툴팁에 넣지 마라. 이유: UI_GUIDE §6 필수 요소 5번.
- 랜딩 히어로의 신호 카드(게이지·"높음")를 재사용하지 마라. 이유: 랜딩 예시 전용(UI_GUIDE §4).
- `src/features/judgment/ui/`에서 `@/server/*`를 import하지 마라. 이유: 클라이언트에서도 렌더링되는 모듈이다.
- 기존 테스트를 깨뜨리지 마라.
