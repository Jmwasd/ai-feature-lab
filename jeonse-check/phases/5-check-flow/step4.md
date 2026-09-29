# Step 4: error-states

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/UI_GUIDE.md` (§1 해요체, §4 `TextInput` 오류 상태, §6 금지 표현, §7)
- `/docs/PRD.md` (MVP 범위·제외)
- `/.claude/skills/jeonse-design/SKILL.md`
- `/src/app/check/_actions/*` (step 2: `CheckError` 코드)
- `/src/app/check/_components/CheckFlow.tsx` (step 3)
- `/src/features/judgment/copy.ts`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

조회 흐름의 실패·예외 상황을 사용자에게 설명하고 다음 행동을 안내한다.

### 1. 오류 코드별 화면

`src/app/check/_components/CheckError.tsx`: `CheckError` 코드마다 제목·설명·행동 버튼을 둔다. 문구는 `src/app/check/_components/error-copy.ts`에 모은다.

| 코드 | 안내 | 행동 |
|---|---|---|
| `invalid-input` | 입력을 확인해 달라 | 해당 단계로 돌아가기(입력 유지) |
| `address-not-found` | 주소를 다시 검색해 달라 | 1단계로 |
| `unsupported-house` | MVP는 아파트·연립다세대만 지원 | 처음으로 |
| `quota` | 공공데이터 호출이 많아 잠시 뒤 다시 | 다시 시도 |
| `lookup-failed` | 공공데이터를 불러오지 못했다 | 다시 시도 |
| `unauthorized` | 다시 로그인 | 로그인 |

- 오류 화면에서도 "안전", "문제없음" 같은 표현을 쓰지 마라. 특히 데이터가 없을 때 "위험 신호 0개"처럼 보이면 안 된다. 이유: 데이터가 없는 것은 위험이 없는 것이 아니다.

### 2. 데이터 부족 결과

- 판정은 됐지만 시세가 `none`이거나 경고가 있는 결과는 오류가 아니다. `ResultView`의 notes로 이미 보인다. 이 step에서는 결과 상단에 "일부 데이터를 불러오지 못해 판단이 제한돼요" 요약 줄을 추가할지 검토하고, 추가한다면 문구를 `copy.ts`에 두고 금지 표현 테스트에 넣는다.

### 3. Next 라우트 오류 경계

- `src/app/check/error.tsx`(Client Component): 예상 못 한 예외 시 일반 안내와 다시 시도. 오류 객체의 메시지를 화면에 출력하지 마라.
- `src/app/not-found.tsx`: 토큰 스타일의 간단한 404.

### 4. 테스트

- 코드별 화면 문구와 행동 버튼, `invalid-input`에서 입력 유지, 모든 오류 문구에 금지 표현 없음, 오류 화면에 "위험 신호" 헤드라인이 나오지 않음.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 금지사항

- 원본 예외 메시지·스택을 화면에 보이지 마라. 이유: 내부 정보와 서비스키가 담긴 URL이 샐 수 있다.
- 데이터가 없을 때 신호 0개 결과를 보여주지 마라. 이유: 위 1번.
- 자동 재시도 루프를 만들지 마라. 이유: 한도 초과 상황에서 호출을 더 쓴다. 재시도는 사용자가 누를 때만.
- 기존 테스트를 깨뜨리지 마라.
