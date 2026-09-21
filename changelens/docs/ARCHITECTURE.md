# ARCHITECTURE: changelens

## 한눈에

CLI가 Next.js 서버를 띄우고 브라우저를 연다. 서버는 **한 프로세스**다. 별도 API 서버나 DB는 없다.

```
bin/changelens.mjs  ──(CHANGELENS_REPO 환경변수)──▶  Next.js 서버 (localhost:3000)
                                                      │
       브라우저 ──▶ /            랜딩 + GIS 로그인 버튼
                │   POST /api/session   ID 토큰 검증 → 세션 쿠키
                └─▶ /repo, /repo/[sha]  미들웨어 통과 후 서버 컴포넌트가 렌더
                                                      │
                                    lib/git/*  ──▶ git CLI (child_process)
                                    lib/summary/* ─▶ Anthropic API + 홈 디렉터리 캐시
```

## 실행 형태

`bin/changelens.mjs`가 하는 일은 네 가지뿐이다.

1. 인자로 받은 경로(없으면 `process.cwd()`)를 절대 경로로 바꾸고 `git rev-parse --git-dir`로 저장소인지 확인한다. 저장소가 아니면 경고만 출력하고 서버는 그대로 띄운다(ADR-2의 "화면에서 설명한다" 원칙).
2. 그 경로를 `CHANGELENS_REPO` 환경변수로 넣는다. **포트는 3000 고정**이다(ADR-5).
3. `next start`를 자식 프로세스로 띄운다.
4. 서버가 응답하기 시작하면 브라우저로 `http://localhost:3000`을 연다.

개발 중에는 `npm run dev`를 그대로 쓰고, 저장소 경로는 `.env.local`의 `CHANGELENS_REPO`로 준다.

## 디렉터리

```
bin/changelens.mjs        CLI 진입점
middleware.ts             /repo 이하 세션 게이트
app/
  page.tsx                랜딩 (기능 소개 + 로그인 버튼)
  repo/page.tsx           지표 + 커밋 목록
  repo/[sha]/page.tsx     커밋 상세 (파일 목록 + diff + 요약)
  api/session/route.ts    POST: ID 토큰 검증 → 쿠키 발급 / DELETE: 로그아웃
  api/commits/route.ts    GET: 다음 50개 커밋 (더 보기)
  api/summary/[sha]/route.ts  GET: 커밋 요약 (캐시 우선)
lib/
  git/                    git 호출과 출력 파싱 (여기 말고 어디서도 child_process 금지)
  summary/                Anthropic 호출, diff 상한, 캐시 입출력
  auth/                   ID 토큰 검증, 세션 쿠키 서명·검증
components/               화면 컴포넌트
types/                    공유 타입
```

## git 접근 계층 (`lib/git/`)

`git` CLI를 `child_process.execFile`로 호출하고 출력을 파싱한다(ADR-1). 규칙:

- 인자는 **배열로만** 넘긴다. 셸 문자열 보간 금지.
- 커밋 해시는 `^[0-9a-f]{7,40}$`를 통과한 값만 git에 넘긴다.
- 출력 파싱은 사람이 읽는 기본 포맷에 기대지 않는다. `--pretty=format:` 에 `%x1f`(단위 구분자)와 `%x1e`(레코드 구분자)를 써서 필드를 자른다. 커밋 메시지에 개행·탭이 들어와도 깨지지 않아야 한다.
- 모든 호출에 작업 디렉터리를 명시한다(`cwd: repoPath`). 전역 git 설정에 기대지 마라.

필요한 호출은 네 가지다.

| 용도 | 명령 |
|---|---|
| 커밋 목록(페이지 단위) | `git log --skip=N --max-count=50 --pretty=format:... --numstat` |
| 지표 집계 | `git log --pretty=format:%H%x1f%an%x1f%aI --numstat` 1회 스캔 |
| 커밋 상세 메타 + 파일 목록 | `git show --stat --pretty=format:... <sha>` |
| 파일별 diff | `git show --format= --unified=3 <sha>` |

머지 커밋은 목록에 **포함**하되 통계(파일 수·추가·삭제 줄)는 첫 번째 부모 기준으로 계산한다(`git show -m --first-parent`). 바이너리 파일은 numstat이 `-`를 주므로 줄 수 대신 "바이너리"로 표시한다.

지표 4종은 전체 이력 1회 스캔으로 한꺼번에 계산하고 **서버 프로세스 메모리에 캐시**한다(키: 저장소 경로 + HEAD sha). HEAD가 바뀌면 다시 계산한다.

## 인증 계층 (`lib/auth/`)

1. 랜딩에서 GIS 버튼(`NEXT_PUBLIC_GOOGLE_CLIENT_ID`)이 ID 토큰을 준다. 클라이언트 ID가 없으면 버튼 자리에 발급 방법 안내를 띄우고 로그인을 막는다.
2. 클라이언트가 그 토큰을 `POST /api/session`으로 보낸다.
3. 서버가 `google-auth-library`의 `OAuth2Client.verifyIdToken`으로 서명·`aud`·만료를 검증한다. 허용 계정 제한은 두지 않는다.
4. 통과하면 `{ sub, email, name, picture, exp }`를 `AUTH_SECRET`으로 서명해 **HttpOnly, SameSite=Lax, Path=/** 쿠키로 굽는다. 쿠키 만료는 ID 토큰의 `exp`와 같다(약 1시간).
5. `middleware.ts`가 `/repo` 이하 요청마다 쿠키 서명과 만료를 검사한다. 실패하면 `/?next=<원래 경로>`로 303 리다이렉트한다. `next` 값은 `/`로 시작하는 내부 경로만 허용한다(`//`나 `http`로 시작하면 버린다). 로그인 성공 후 그 경로로 돌아간다.

세션 저장소는 없다. 상태는 서명된 쿠키 안에만 있으므로 서버를 재시작해도 로그인이 유지된다.

## 요약 계층 (`lib/summary/`)

상세 페이지가 열릴 때 호출한다. 목록에서는 호출하지 않는다.

- SDK: `@anthropic-ai/sdk`, 모델 `claude-sonnet-5`.
- 요청: `max_tokens: 4096`, `thinking: { type: "adaptive" }`, `output_config: { effort: "low" }`. `budget_tokens`는 이 모델에서 400을 받으므로 쓰지 마라. 어시스턴트 프리필도 400이다.
- 클라이언트는 `new Anthropic({ timeout: 30_000, maxRetries: 1 })`로 만든다. SDK 기본 타임아웃(10분)은 페이지 렌더를 붙잡는다.
- 입력: 커밋 메시지, 파일 목록과 numstat 전체 + diff 본문. **diff 본문은 200KB까지만** 보낸다(ADR-4). 잘렸으면 프롬프트에 그 사실을 적고, 화면 요약 아래에도 "diff 일부만 읽고 쓴 요약"이라고 표시한다. 조용히 자르지 마라.
- 출력: 한 문단 요약과 3줄 이내의 변경 포인트. 커밋 메시지를 그대로 옮겨 적지 말고 diff가 실제로 한 일을 쓰라고 지시한다.
- 캐시: `~/.changelens/<저장소경로 해시>/<sha>.json`. 커밋은 불변이므로 무효화 규칙이 없다. 읽기 실패는 캐시 미스로 취급한다.
- 실패 처리: `Anthropic.AuthenticationError` → "API 키를 확인하라", `Anthropic.RateLimitError` → "잠시 후 다시", 그 밖의 `Anthropic.APIError`와 타임아웃 → 일반 안내. 어느 경우에도 **요약 칸만 접히고 git 화면은 그대로 렌더된다**. `ANTHROPIC_API_KEY`가 없으면 아예 호출하지 않고 요약 칸을 숨긴다.
- `response.stop_reason`을 먼저 확인한다. `refusal`이면 요약 없이 안내만 띄운다.

## 라우트와 환경변수

| 경로 | 보호 | 하는 일 |
|---|---|---|
| `/` | 공개 | 랜딩, 기능 소개, GIS 로그인 버튼 |
| `/repo` | 미들웨어 | 지표 4종 + 커밋 카드 50개 |
| `/repo/[sha]` | 미들웨어 | 커밋 메타, 파일 목록, 파일별 diff, 요약 |
| `POST /api/session` | 공개 | ID 토큰 검증 → 세션 쿠키 |
| `DELETE /api/session` | 미들웨어 | 로그아웃 (쿠키 삭제) |
| `GET /api/commits?skip=N` | 미들웨어 | 다음 50개 |
| `GET /api/summary/[sha]` | 미들웨어 | 요약 (캐시 우선) |

| 환경변수 | 노출 | 없을 때 |
|---|---|---|
| `CHANGELENS_REPO` | 서버 전용 | `process.cwd()` |
| `AUTH_SECRET` | 서버 전용 | 서버 기동 실패 (세션을 서명할 수 없다) |
| `ANTHROPIC_API_KEY` | 서버 전용 | 요약 기능만 비활성 |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | 클라이언트 | 랜딩에 발급 안내, 로그인 버튼 비활성 |

## 빈 상태와 에러

서버는 어떤 경우에도 뜬다. 화면이 이유를 말한다.

- git 저장소가 아님 → `/repo`에 "여긴 git 저장소가 아니다"와 현재 경로, 다시 실행하는 법.
- 커밋 0개 → "아직 커밋이 없다".
- 없는 sha → 404 화면에서 목록으로 돌아가는 링크.
- git 명령 실패 → 화면에 stderr 첫 줄까지 보여준다. 삼키지 마라.

## 테스트 전략

Vitest. `lib/git/` 테스트는 임시 디렉터리에 실제 저장소를 만들어(`git init`, 파일 쓰기, `git commit`) 검증한다. 최소한 이 네 가지는 픽스처로 덮는다: 여러 줄 메시지를 가진 커밋, 파일 이름 변경, 바이너리 파일, 머지 커밋. Anthropic 호출과 캐시 입출력은 모킹한다.

AC 커맨드: `npm run build && npm test`
