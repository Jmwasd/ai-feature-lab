# Step 4: resume-dump-script

## 읽어야 할 파일

- `src/types/index.ts` — `ResumeEvidence`
- `src/services/notion.ts` — `getResumeEvidence` · `fetchBlockTree`
- `src/lib/resume-parser.ts` — `parseResume`
- `package.json` — 기존 scripts

## 이 step이 존재하는 이유

M0의 완료 기준은 "내 Notion 이력서가 근거 목록으로 나온다"이다. 파서 테스트는 손으로 만든 fixture로 돌기 때문에 **진짜 이력서가 어떻게 잘리는지는 보여주지 않는다.** 화면은 `1-job-posting` phase에 가서야 생기므로 그때까지는 이 스크립트가 유일한 확인 경로다.

## 작업

### 1. 스크립트

`scripts/dump-resume.ts`를 만든다. **짧게 유지하라 — 출력이 전부다.**

- `getResumeEvidence()`를 호출한다
- 맨 위에 총 개수를 찍는다
- 각 근거마다 `[번호] 회사 > 프로젝트` / `blockId` / **원문 그대로** 세 줄. `company`가 비면 `(소속 없음)`
- 환경 변수가 없으면 무엇을 `.env.local`에 넣어야 하는지 알려주고 종료 코드 1로 끝낸다. 스택 트레이스만 뱉고 죽지 마라

원문을 자르지 마라. 어디가 잘려 나갔는지 보려고 만드는 스크립트인데 출력을 자르면 볼 수가 없다.

`server-only`를 import 한 모듈을 Node 스크립트에서 부르면 실행이 막힐 수 있다. 막히면 스크립트 안에서 `fetchBlockTree` + `parseResume`를 직접 조립하라. **`src/services/notion.ts`에서 `server-only`를 빼는 방식으로 해결하지 마라.**

### 2. 실행 경로

`tsx`를 devDependency로 설치하고 `package.json`에 추가한다:

```
"resume:dump": "tsx --env-file=.env.local scripts/dump-resume.ts"
```

`--env-file`이 이 Node 버전에서 안 되면 스크립트 안에서 `.env.local`을 직접 파싱해도 된다. 다만 **`dotenv`를 새로 설치하지는 마라.**

## Acceptance Criteria

```bash
npm run build     # 컴파일 에러 없음
npm run lint      # 통과
npm test          # 기존 테스트 전부 통과
npx tsc --noEmit  # 스크립트 포함 타입 에러 없음

npx tsx scripts/dump-resume.ts
# 환경 변수가 없다는 안내가 나오고 종료 코드 1이어야 한다
```

`npm run resume:dump`는 AC에 넣지 않는다. 실제 Notion 토큰이 필요하고, 그것은 사용자가 `.env.local`을 채운 뒤 직접 실행한다.

**이 step은 `blocked`가 되면 안 된다.** 스크립트를 만들고 타입 체크하는 것까지가 범위다.

`summary`에는 스크립트 경로와 npm script 이름을 적어라.

## 금지사항

- **`scripts/execute.py`와 `scripts/test_execute.py`를 수정하거나 지우지 마라.** 이유: 하네스 자신이다. 망가지면 다음 phase를 실행할 수 없다
- **결과를 파일(JSON·CSV·마크다운)로 저장하지 마라.** 이유: ADR-005 — 덤프 파일이 하나 생기면 그것이 이력서의 두 번째 사본이 되고, 어느 쪽이 최신인지 관리해야 한다. stdout에만 쓴다
- **`src/services/notion.ts`에서 `import 'server-only'`를 빼지 마라.** 이유: 그것이 토큰이 브라우저 번들로 새는 것을 빌드 시점에 막는 장치다
- **파싱·순회 로직을 스크립트에 다시 구현하지 마라.** 이유: 사본이 생기면 스크립트로 확인한 결과와 앱이 실제로 쓰는 결과가 갈라져 이 스크립트의 존재 이유가 사라진다
- **통계·집계·정렬을 붙이지 마라.** 이유: 확인용 출력 하나다. 근거 목록을 눈으로 훑는 것 이상을 하면 유지할 물건이 하나 더 생긴다
- **`.env.local`을 만들지 마라.** 이유: 키가 없고 실수로 커밋될 위험만 생긴다
- **`dotenv`를 설치하지 마라.** 이유: Node가 이미 `--env-file`을 지원한다
- **`src/`에 파일을 추가하지 마라.** 이유: 이 step의 산출물은 `scripts/dump-resume.ts`와 `package.json` 한 줄뿐이다
