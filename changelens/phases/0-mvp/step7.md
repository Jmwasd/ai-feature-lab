# Step 7: cli

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` — 「실행 형태」, 「라우트와 환경변수」
- `/docs/ADR.md` — ADR-2(localhost 전용), ADR-5(포트 3000)
- Step 0 산출물: `package.json`(scripts), `vitest.config.ts`(include에 `*.test.mjs` 포함)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`node bin/changelens.mjs [저장소경로]`로 빌드 결과를 띄우고 브라우저를 여는 CLI를 만든다. **테스트를 먼저 쓴다.**

### 1. `bin/cli-lib.mjs` — 순수 함수 (테스트: `bin/cli-lib.test.mjs`)

```js
export function resolveRepoArg(arg, cwd);          // 인자 없으면 cwd, 상대 경로는 cwd 기준 절대 경로
export function openCommand(platform, url);        // → { cmd, args }. win32: cmd /c start "" <url>, darwin: open, 그 외: xdg-open
export function portInUseMessage(port);            // ADR-5 안내: 다른 프로세스를 끄라, 포트를 바꾸려면 Google Cloud 콘솔 원본 등록도 바꿔야 한다
export async function isPortFree(port);            // 잠깐 listen해 보고 닫는다
export async function waitForServer(url, timeoutMs); // 응답이 올 때까지 짧게 재시도, 시간 초과면 false
```

### 2. `bin/changelens.mjs` — 진입점

ARCHITECTURE 「실행 형태」의 네 단계 그대로:

1. `resolveRepoArg(process.argv[2], process.cwd())`. `git rev-parse --git-dir`(`execFile`, 인자 배열, `cwd`=그 경로)가 실패하면 **경고만** 출력하고 계속한다.
2. `isPortFree(3000)`이 거짓이면 `portInUseMessage(3000)`을 출력하고 종료 코드 1.
3. 패키지 루트(`bin/`의 부모)에 `.next/BUILD_ID`가 없으면 `npm run build`를 먼저 하라고 출력하고 종료 코드 1.
4. `process.execPath`로 `next`의 bin(`next/dist/bin/next`)을 `start -p 3000 -H localhost`로 띄운다. `cwd`는 패키지 루트, `env`에 `CHANGELENS_REPO=<절대경로>`를 더하고 `stdio: "inherit"`.
5. `waitForServer("http://localhost:3000", 30_000)`가 참이면 `openCommand(process.platform, url)`로 브라우저를 연다. 실패하면 URL만 출력한다.
6. `SIGINT`/`SIGTERM`을 자식에 넘기고, 자식 종료 코드로 끝낸다.

- 이 파일은 ARCHITECTURE 「실행 형태」에 따라 `lib/git/` 밖에서 `child_process`를 쓰는 유일한 곳이다. 쓰는 곳은 `git rev-parse --git-dir` 한 번, `next start`, 브라우저 열기뿐이다.
- `package.json`에 `"bin": { "changelens": "bin/changelens.mjs" }`를 더한다. 파일 첫 줄은 `#!/usr/bin/env node`.

### 3. 테스트

- `resolveRepoArg`: 인자 없음, 상대 경로, 절대 경로.
- `openCommand`: `win32`·`darwin`·`linux` 세 가지.
- `portInUseMessage`: 포트 번호와 Google Cloud 원본 안내를 담는다.
- `isPortFree`: 테스트 안에서 임의 포트를 점유한 뒤 `false`, 닫은 뒤 `true`.
- `waitForServer`: 테스트 안에서 띄운 `http` 서버에 `true`, 아무도 없는 포트에 짧은 시한으로 `false`.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm test                                   # bin/cli-lib 테스트 포함
node --check bin/changelens.mjs            # 문법 오류 없음
```

AC에서 `node bin/changelens.mjs`를 실제로 실행하지 마라 — 빌드가 있으면 서버를 띄우고 끝나지 않아 step이 멈춘다.

## 금지사항

- 3000이 점유돼 있을 때 다른 포트를 찾지 마라. 이유: ADR-5 — GIS 원본 등록이 3000에 묶여 있다.
- `-H localhost`를 빼거나 `0.0.0.0`으로 띄우지 마라. 이유: ADR-2 — localhost 전용.
- `npx`, `shell: true`, `exec`로 `next`를 띄우지 마라. 이유: Windows에서 `.cmd` 해석과 경로 공백(`문서` 등)이 깨지고, 셸 보간이 생긴다.
- 저장소가 아니라는 이유로 서버를 띄우지 않고 끝내지 마라. 이유: ARCHITECTURE — 서버는 뜨고 화면이 이유를 설명한다.
- CLI가 `npm run build`를 대신 실행하지 마라. 이유: 빌드는 네트워크(폰트)가 필요하고 오래 걸린다. 안내만 한다.
- 새 패키지(`open`, `commander`, `get-port` 등)를 추가하지 마라. 이유: 스택 고정, Node 내장으로 충분하다.
