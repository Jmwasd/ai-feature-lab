# Step 4: resume-dump-script

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `docs/PLAN.md` — 8절 "구현 순서". **M0의 완료 기준은 "내 Notion 이력서가 근거 목록으로 나온다"이다**
- `docs/ARCHITECTURE.md`
- `docs/ADR.md` — ADR-005(아무것도 저장하지 않는다)
- `src/types/index.ts` — `ResumeEvidence`
- `src/lib/resume-parser.ts` — 파서
- `src/services/notion.ts` — `getResumeEvidence`
- `package.json` — 기존 scripts

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 이 step이 존재하는 이유

M0의 완료 기준은 "내 Notion 이력서가 근거 목록으로 나온다"이다. 파서 테스트는 손으로 만든 fixture로 돌기 때문에 **진짜 이력서가 어떻게 잘리는지는 보여주지 않는다.** 실제 페이지를 한 번 읽어 눈으로 확인할 수단이 필요하다.

화면(`/api/analyze`)은 `1-job-posting` phase에 가서야 생기므로, 그때까지는 CLI 스크립트가 유일한 확인 경로다.

## 작업

### 1. 스크립트

`scripts/dump-resume.ts`를 만든다.

- `getResumeEvidence()`를 호출해 `ResumeEvidence[]`를 받는다
- 사람이 읽을 형태로 stdout에 출력한다:
  - 맨 위에 총 개수
  - 각 근거마다 `[번호] 회사 > 프로젝트` / `blockId` / 원문
  - 원문이 길면 앞부분만 자르고 잘렸음을 표시한다 (200자 정도)
  - `company`가 빈 문자열이면 `(소속 없음)`으로 표시한다
- 맨 아래에 회사별 근거 개수 요약을 붙인다. 어느 회사가 통째로 안 잡혔는지 한눈에 보이게 하기 위해서다
- 환경 변수가 없으면 **무엇을 `.env.local`에 넣어야 하는지** 알려주는 메시지를 내고 종료 코드 1로 끝낸다

`server-only`를 import 한 모듈을 Node 스크립트에서 부르면 실행이 막힐 수 있다. 막히면 `getResumeEvidence`를 감싸는 대신 스크립트에서 `fetchBlockTree` + `parseResume`를 직접 조립하고, Notion 클라이언트 생성과 환경 변수 읽기를 스크립트 안에서 한다. **`src/services/notion.ts`에서 `server-only`를 빼는 방식으로 해결하지 마라** — 그것이 클라이언트 유출을 막는 구조적 장치다.

### 2. 실행 경로

`tsx`를 devDependency로 설치하고 `package.json`에 스크립트를 추가한다:

```
"resume:dump": "tsx --env-file=.env.local scripts/dump-resume.ts"
```

`--env-file`이 이 Node 버전에서 동작하지 않으면 스크립트 안에서 `.env.local`을 직접 파싱해도 된다. 다만 **`dotenv` 패키지를 새로 설치하지는 마라** — 이 스크립트 하나를 위해 런타임 의존성을 늘릴 이유가 없다.

### 3. 사용법 기록

`CLAUDE.md`의 "명령어" 절에 `npm run resume:dump` 한 줄을 추가한다. 다른 내용은 건드리지 마라.

## Acceptance Criteria

```bash
npm run build     # 컴파일 에러 없음
npm run lint      # 통과
npm test          # 기존 테스트 전부 통과
npx tsc --noEmit  # 스크립트 포함 타입 에러 없음
```

`npm run resume:dump`는 AC에 넣지 않는다. 실제 Notion 토큰이 필요하고, 그것은 사용자가 `.env.local`을 채운 뒤 직접 실행한다.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 키 없이 동작을 확인한다:
   ```bash
   npx tsx scripts/dump-resume.ts
   # NOTION_TOKEN / NOTION_RESUME_PAGE_ID가 없다는 안내가 나오고 종료 코드 1이어야 한다.
   # 스택 트레이스만 뱉고 죽으면 안 된다.
   ```
3. 아키텍처 체크리스트를 확인한다:
   - 레이어 방향을 지켰는가? 스크립트가 `services`와 `lib`을 쓰기만 하고, 파싱·순회 로직을 다시 구현하지 않았는가?
   - `CLAUDE.md` CRITICAL 규칙을 위반하지 않았는가? 특히:
     - 결과를 파일로 저장하지 않았는가 (ADR-005 — stdout에만 쓴다)
     - `src/services/notion.ts`의 `server-only`를 제거하지 않았는가
   - `scripts/execute.py` · `scripts/test_execute.py`를 건드리지 않았는가?
4. 결과에 따라 `phases/0-notion-resume/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

**이 step은 `blocked`가 되면 안 된다.** 스크립트를 만들고 타입 체크하는 것까지가 범위이고, 실제 실행은 사용자 몫이다. `.env.local`이 없다는 이유로 중단하지 마라.

## 금지사항

- **`scripts/execute.py`와 `scripts/test_execute.py`를 수정하거나 지우지 마라.** 이유: 하네스 자신이다. 망가지면 다음 phase를 실행할 수 없다
- **결과를 파일(JSON·CSV·마크다운)로 저장하지 마라.** 이유: ADR-005 — 아무것도 저장하지 않는다. 덤프 파일이 하나 생기면 그것이 이력서의 두 번째 사본이 되고, 어느 쪽이 최신인지 관리해야 한다
- **`src/services/notion.ts`에서 `import 'server-only'`를 빼지 마라.** 이유: 그것이 토큰이 브라우저 번들로 새는 것을 빌드 시점에 막는 장치다. 스크립트 편의를 위해 보안 장치를 떼면 안 된다
- **파싱·순회 로직을 스크립트에 다시 구현하지 마라.** 이유: 사본이 생기면 스크립트로 확인한 결과와 앱이 실제로 쓰는 결과가 갈라진다. 그러면 이 스크립트의 존재 이유가 사라진다
- **`.env.local`을 만들지 마라.** 이유: 키가 없고 실수로 커밋될 위험만 생긴다
- **`dotenv`를 설치하지 마라.** 이유: Node가 이미 `--env-file`을 지원한다
- **`src/`에 파일을 추가하지 마라.** 이유: 이 step의 산출물은 `scripts/dump-resume.ts`와 `package.json` 스크립트 한 줄뿐이다
- 기존 테스트를 깨뜨리지 마라
