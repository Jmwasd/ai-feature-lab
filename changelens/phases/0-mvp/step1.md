# Step 1: git-layer

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` — 「git 접근 계층」 전체, 「빈 상태와 에러」, 「테스트 전략」
- `/docs/ADR.md` — ADR-1
- Step 0 산출물: `package.json`, `tsconfig.json`, `vitest.config.ts`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

git CLI를 호출해 파싱하는 계층 `lib/git/`을 만든다. 이 계층 밖에서는 `child_process`를 쓰지 않는다. **테스트를 먼저 쓴다.**

### 1. 테스트 픽스처 — `tests/helpers/git-fixture.ts`

임시 디렉터리에 실제 저장소를 만드는 도우미. 인터페이스는 재량이지만 아래를 지킨다.

- 전역 설정과 분리한다: `GIT_CONFIG_GLOBAL`을 빈 파일로, `GIT_CONFIG_NOSYSTEM=1`, `GIT_AUTHOR_NAME/EMAIL/DATE`, `GIT_COMMITTER_NAME/EMAIL/DATE`를 환경변수로 준다. 기본 브랜치는 `git init -b main`.
- 픽스처로 만들 수 있어야 하는 경우: 여러 줄(개행·탭 포함) 메시지, 파일 이름 변경, 바이너리 파일, 머지 커밋, **한글·공백이 들어간 파일명**(예: `문서 메모.txt`), 커밋 0개 저장소.

### 2. 타입 — `types/git.ts`

```ts
export type FileStat = { path: string; oldPath?: string; additions: number | null; deletions: number | null }; // null = 바이너리
export type CommitSummary = {
  sha: string; subject: string; authorName: string; authorDate: string; // authorDate는 %aI 그대로
  files: number; additions: number; deletions: number; isMerge: boolean;
};
export type RepoStatus =
  | { kind: "git-missing" }
  | { kind: "not-repo"; path: string }
  | { kind: "empty"; path: string; branch: string | null }
  | { kind: "ok"; path: string; head: string; branch: string | null }; // branch null = detached HEAD
export type RepoMetrics = {
  head: string; branch: string | null; totalCommits: number;
  firstDate: string; lastDate: string; additions: number; deletions: number;
  contributors: number; topContributor: string; // 커밋 수가 가장 많은 작성자 이름
};
export type DiffLine = { kind: "add" | "del" | "ctx"; text: string }; // text는 앞 +/-/공백 기호를 그대로 포함
export type DiffHunk = { header: string; lines: DiffLine[] };        // header 예: "@@ -1,8 +1,34 @@"
export type FileDiff = {
  path: string; oldPath?: string; binary: boolean;
  omitted: boolean; // 파일 diff 본문이 256KB를 넘으면 true, hunks는 비운다
  lineCount: number; hunks: DiffHunk[];
};
export type CommitDetail = {
  sha: string; subject: string; body: string; authorName: string; authorDate: string;
  parents: string[]; files: FileStat[]; additions: number; deletions: number; diffs: FileDiff[];
};
```

필드를 더해야 하면 더해도 된다. 이름을 바꾸지는 마라 — 이후 step이 이 이름으로 쓴다.

### 3. 구현 — `lib/git/`

| 파일 | 내보내는 것 |
|---|---|
| `run.ts` | `runGit(repoPath: string, args: string[]): Promise<string>`, `GitError`(`message` = stderr 첫 줄, `stderr` 전체), `GitNotInstalledError`, `isValidSha(s: string): boolean`, `resolveRepoPath(): string` |
| `repo.ts` | `getRepoStatus(repoPath: string): Promise<RepoStatus>` |
| `log.ts` | `listCommits(repoPath: string, opts?: { skip?: number; limit?: number }): Promise<CommitSummary[]>` — 기본 limit 50, 최신순 |
| `metrics.ts` | `getRepoMetrics(repoPath: string): Promise<RepoMetrics>` — 전체 이력 1회 스캔, 메모리 캐시(키: 경로 + HEAD sha) |
| `show.ts` | `getCommitDetail(repoPath, sha): Promise<CommitDetail>`, `getCommitPatch(repoPath, sha): Promise<string>`(요약용 diff 원문), `CommitNotFoundError` |
| `index.ts` | 위 공개 API 재수출. 다른 레이어는 `@/lib/git`에서만 가져온다 |

핵심 규칙 (ARCHITECTURE 「git 접근 계층」):

- `execFile("git", args, { cwd: repoPath, maxBuffer: 256MB 수준, encoding: "utf8" })`. 셸 문자열 보간 금지.
- 매 호출에 `-c core.quotePath=false`, `--no-color`를, diff를 내는 호출에는 `--no-ext-diff`, `-M`, `--src-prefix=a/ --dst-prefix=b/`를 붙인다.
- 필드는 `--pretty=format:`에 `%x1f`/`%x1e`로 자른다. 기본 출력 포맷에 기대지 마라.
- `resolveRepoPath()`는 `CHANGELENS_REPO`, 없으면 `process.cwd()`를 절대 경로로 돌려준다.
- `isValidSha`는 `^[0-9a-f]{7,40}$`. `getCommitDetail`·`getCommitPatch`는 통과한 값만 git에 넘기고, 통과 못 하거나 git이 커밋을 못 찾으면 `CommitNotFoundError`를 던진다.
- `getRepoStatus`: 경로가 없으면 `not-repo`(execFile은 없는 cwd에도 ENOENT를 내므로 git 없음과 구분하려면 경로 존재를 먼저 본다), git 바이너리가 없으면 `git-missing`, 커밋이 없으면 `empty`.
- 머지 커밋 통계는 `--diff-merges=first-parent`. `git log`에 `--first-parent`를 넣지 마라.
- 지표의 추가·삭제 합계에서 머지 커밋 diff는 뺀다. `totalCommits`에는 머지를 센다.
- 바이너리는 numstat `-` → `additions/deletions: null`, `FileDiff.binary: true`.
- 이름 변경은 `oldPath`를 채운다. numstat의 `a => b`, `dir/{a => b}/f` 형태를 모두 푼다.
- diff 경로를 `diff --git a/… b/…` 줄에서 공백으로 자르지 마라 — 경로에 공백이 있으면 모호하다. `rename from/to`, `---`/`+++` 줄, 또는 numstat 순서와 맞춰 얻는다.
- 파일 diff 본문이 256KB를 넘으면 `omitted: true`, `hunks: []`. `lineCount`는 채운다.

### 4. 테스트 — `lib/git/*.test.ts`

픽스처 저장소로 검증한다. 파싱 계층을 모킹하지 마라. 최소한:

- 여러 줄 메시지 커밋의 `subject`와 `body`가 정확히 나뉜다.
- 이름 변경의 `path`/`oldPath`, 바이너리의 `null`, 한글·공백 파일명이 이스케이프 없이 그대로 나온다.
- 머지 커밋이 목록에 있고 `isMerge: true`, 통계는 첫 부모 기준. 머지로 들어온 브랜치 커밋들도 목록에 있다(이력 순회가 줄지 않았다).
- `listCommits`의 `skip`·`limit` 페이지 경계.
- `getRepoMetrics`의 커밋 수·기간·합계(머지 제외)·기여자 수·최다 기여자.
- `getRepoStatus`의 `not-repo`, `empty`, `ok`(branch, detached HEAD면 null).
- 없는 sha와 형식이 틀린 sha → `CommitNotFoundError`. 실패한 git 명령 → `GitError.message`가 stderr 첫 줄.
- 256KB 넘는 파일 → `omitted: true`.

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # lib/git 테스트 통과
```

## 금지사항

- `simple-git`, `isomorphic-git`, `nodegit` 같은 라이브러리를 쓰지 마라. 이유: ADR-1.
- `lib/git/` 밖에서 `child_process`를 import하지 마라. 이유: CLAUDE.md — git 접근은 한 곳에 모은다.
- `exec`나 `shell: true`를 쓰지 마라. 이유: 사용자 입력(sha, skip)이 셸로 해석된다.
- 테스트에서 개발자 PC의 전역 git 설정에 기대지 마라. 이유: `commit.gpgsign`, `init.defaultBranch` 같은 설정이 PC마다 달라 테스트가 깨진다.
- git 에러를 빈 배열이나 기본값으로 삼키지 마라. 이유: 화면이 stderr 첫 줄을 보여줘야 한다(ARCHITECTURE 「빈 상태와 에러」).
- 라우트·화면·요약 코드를 만들지 마라. 이유: 이 step은 git 계층만 다룬다.
