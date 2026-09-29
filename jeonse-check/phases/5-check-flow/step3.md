# Step 3: check-page

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (결과 표시 CRITICAL)
- `/docs/ARCHITECTURE.md` (routes: 조합만, Client Component는 server를 import하지 않음)
- `/docs/UI_GUIDE.md` (§3 레이아웃, §4 단계 진행 탭, §5 모션, §6 결과 화면 필수 요소)
- `/.claude/skills/jeonse-design/SKILL.md`
- `/src/app/check/page.tsx` (phase 1의 자리 페이지: 세션 확인 유지)
- `/src/app/check/_actions/*` (step 2)
- `/src/features/lookup-input/LookupForm.tsx`, `/src/features/rights-input/RightsForm.tsx` (phase 2)
- `/src/features/judgment/ui/*`, `serialize.ts` (phase 2, step 2)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`/check` 페이지를 실제 조회 흐름으로 바꾼다: 조회 조건 → 권리 입력 → 판정 → 결과.

### 1. 페이지 구성

- `src/app/check/page.tsx`(Server Component): `auth()` 확인은 그대로 둔다. 클라이언트 흐름 컴포넌트에 Server Action을 props로 넘긴다.
- `src/app/check/_components/CheckFlow.tsx`(`"use client"`): 3단계 상태 머신(`lookup` → `rights` → `result`). 상단에 단계 진행 표시(UI_GUIDE §4).
  - 1단계: `LookupForm`에 `searchAddress`로 `searchAddressAction`을 넘긴다.
  - 2단계: `RightsForm`. 뒤로 가기 시 1단계 입력을 유지한다.
  - 제출: `runCheckAction` 호출 → 대기 화면("실거래가를 모으고 있어요", 첫 조회는 수집 때문에 오래 걸릴 수 있다는 안내) → 결과 역직렬화 → `ResultView`.
  - 결과 화면에 "조건 바꿔 다시 보기" 버튼.
- 서로 다른 feature(`lookup-input`, `rights-input`, `judgment`)의 조합은 이 라우트에서만 한다.

### 2. 결과 화면

- `ResultView`를 그대로 쓴다. UI_GUIDE §6 필수 요소 5개가 모두 보여야 한다.
- 결과에 경고 notes가 있으면 `ResultView`가 이미 보여준다. 페이지에서 별도 문구를 만들지 마라.

### 3. 테스트 (`CheckFlow.test.tsx`)

- 액션을 가짜 함수로 넘겨: 단계 전환, 뒤로 가기 입력 유지, 대기 상태, 성공 시 필수 요소 5개 렌더링, 금지 표현 없음.
- 실패 응답 처리는 step 4 범위이므로 여기서는 오류 코드가 오면 "다시 시도" 수준으로만 처리하고 테스트한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
grep -rn "@/server" src/app/check/_components && exit 1 || true   # Client Component에서 server import 금지
```

## 금지사항

- `CheckFlow`나 `_components`에서 `@/server/*`를 import하지 마라. 이유: CLAUDE.md CRITICAL.
- 결과를 URL 쿼리나 `localStorage`에 저장하지 마라. 이유: 권리관계·보증금 같은 개인 정보가 남는다. 저장은 phase 6 서버 저장으로 한다.
- `ResultView`를 복사해 페이지용으로 고치지 마라. 필요하면 원본을 고친다. 이유: 필수 요소 검사가 한 곳에 걸린다.
- 기존 테스트를 깨뜨리지 마라.
