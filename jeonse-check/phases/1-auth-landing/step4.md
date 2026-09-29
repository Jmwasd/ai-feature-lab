# Step 4: landing-content

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` ("위험 신호 N개" 형식, "안전" 단정 금지 CRITICAL)
- `/docs/ARCHITECTURE.md`
- `/docs/PRD.md` (MVP 제외 사항: "데이터 출처" 섹션의 "지원 안 함" 목록)
- `/docs/UI_GUIDE.md` (§4 선택 탭·비교 막대·단계 진행 탭·미리보기 판·세그먼트 토글·신호 행, §5 내용 교체 모션, §6, §8의 4~6번)
- `/.claude/skills/jeonse-design/SKILL.md`
- `/src/features/judgment/risk-report.ts`, `copy.ts`, `types.ts`, `price-estimate.ts`, `ratios.ts`
- `/src/components/*`, `/src/hooks/use-reveal.ts`, `/src/test/forbidden-phrases.ts`
- `/src/app/_components/*` (step 2·3: `#cases`, `#flow`, `#sources` 자리 섹션)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

랜딩의 사례(`#cases`), 이용 방법(`#flow`), 데이터 출처(`#sources`) 섹션을 채운다.

### 1. 사례 (`CasesSection.tsx`)

- 선택 탭 5개: 깡통전세, 근저당 과다, 신탁 등기, 근린생활시설, 비율이 낮은 빌라.
- 사례마다 예시 입력(보증금, 추정 시세, 공시가격, 채권최고액, 건축물 정보, 권리 입력)을 `src/app/_components/cases-data.ts`에 둔다.
- 오른쪽의 "위험 신호 N개"와 신호 행은 **예시 입력을 `estimateSalePrice`·`jeonseRatio`·`debtRatio`·`checkHugEligibility`·`buildRiskReport`에 넣은 결과**로 렌더링한다. 신호 제목·설명을 이 섹션에서 새로 쓰지 마라. 이유: 랜딩 예시와 실제 판정 문구가 같아야 하고, 금지 표현 검사가 `copy.ts` 한 곳에 걸린다.
- `asOf`와 `dataBaseDate`는 `cases-data.ts`의 고정 날짜 상수로 넘긴다. `new Date()`를 쓰지 마라. 이유: 빌드·테스트 시점마다 신축·소유자 변동 신호가 달라진다.
- 왼쪽: 조건 요약 + 비교 막대(보증금 vs 추정 시세 등). 섹션에 "예시 데이터" 표기.
- "비율이 낮은 빌라" 사례의 신호 수는 0개일 수 있다. 이때도 "위험 신호 0개"로 쓴다.
- 탭 전환 시 UI_GUIDE §5 "내용 교체" 모션. 탭은 `role="tablist"`/`tab`/`tabpanel`과 화살표 키 이동을 지원한다.

### 2. 이용 방법 (`FlowSection.tsx`)

- 단계 진행 탭 3개(주소·보증금 입력 → 등기부 권리 입력 → 결과 확인), 4.5초 자동 진행, 사용자가 탭을 누르면 자동 진행을 멈춘다. reduced-motion이면 자동 진행하지 않는다.
- 오른쪽 미리보기 판은 단계별 설명 카드다. 실제 결과 화면을 흉내 낸 수치나 "안전"류 판정을 넣지 마라.

### 3. 데이터 출처 (`SourcesSection.tsx`)

- 세그먼트 토글 3개: 자동 조회 / 직접 입력 / 지원 안 함.
  - 자동 조회: 국토교통부 실거래가, 공동주택 공시가격, 건축물대장
  - 직접 입력: 등기부 권리관계(근저당 채권최고액, 신탁 여부, 소유자 변동)
  - 지원 안 함: PRD의 MVP 제외 사항(다가구·단독주택, 오피스텔, 등기부·확정일자·국세 체납 자동 조회, KB시세)과 제외 이유
- 출처명은 `copy.ts`에 있으면 그것을 쓴다.

### 4. 테스트

- 사례별로 렌더링된 신호 개수가 같은 입력으로 `buildRiskReport`를 호출한 `signalCount`와 같다.
- 모든 탭 패널, 모든 이용 단계, 모든 출처 토글을 펼친 상태에서 금지 표현이 없다(`src/test/forbidden-phrases.ts`).
- 사례 섹션에 "예시 데이터" 표기가 있다.
- 탭 키보드 이동, 자동 진행 정지(가짜 타이머).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
grep -rn 'new Date()' src/app/_components --include='*.ts*' | grep -v '\.test\.' || true   # 결과가 없어야 한다
```

## 금지사항

- 사례의 신호 문구·개수를 손으로 적지 마라. 이유: 판정 로직과 어긋난다. `buildRiskReport` 결과를 쓴다.
- 결과 화면용 컴포넌트(`SignalSummary` 등)를 `src/components/`에 만들지 마라. 이유: phase 2 범위다. 사례 섹션의 신호 행은 랜딩 `_components/` 안에 둔다.
- MVP 제외 기능을 "곧 지원" 같은 약속으로 쓰지 마라. 이유: 계획에 없다.
- 오피스텔·다가구·결제 관련 UI를 넣지 마라. 이유: UI_GUIDE §6, PRD MVP 제외.
- 기존 테스트를 깨뜨리지 마라.
