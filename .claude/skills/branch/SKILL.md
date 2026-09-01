---
name: branch
description: ai-feature-lab에서 새 git 브랜치를 만든다. 새 작업·`/branch` 요청·main에서의 작업을 발견했을 때 쓴다. `<type>/<project>/<slug>` 규칙으로 origin/main에서 분기·push하고 PR 제목·본문 초안을 낸다.
argument-hint: "[작업 설명]"
---

# branch

이 저장소의 브랜치는 전부 이 규칙을 거쳐 만들어진다.

## 이름

```
<type>/<project>/<slug>
```

### type — 아래 7개만 쓴다

| type | 쓸 때 |
|---|---|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `refactor` | 동작을 바꾸지 않는 구조 변경 |
| `docs` | 문서 |
| `chore` | 설정·빌드·도구·스킬 |
| `test` | 테스트 |
| `exp` | 비교를 목적으로 하는 실험 (아래 `exp/` 절) |

`exp`를 뺀 6개는 커밋 메시지의 conventional commits type과 같은 어휘다. 판단이 갈리면 **커밋에 쓸 type을 그대로** 브랜치에 쓴다.

### project — 폴더명 그대로

`spend-report` · `whiteboard-editor` · `harness` · `peerlens`

저장소 루트 자체를 건드리는 작업(`.claude/`, `README.md`, `CLAUDE.md`, `.gitignore`)은 예약어 **`repo`**.

- 폴더명을 줄이거나 별칭을 만들지 마라. `wb`, `sr` 같은 건 없다. 새 프로젝트가 생기면 그 폴더명이 곧 식별자다.
- CRITICAL: **한 브랜치는 프로젝트 하나만 건드린다.** 두 프로젝트를 고쳐야 하면 브랜치를 둘로 쪼갠다.

  **Why:** 루트 `CLAUDE.md`의 프로젝트 격리 규칙과 같은 선이다. 게다가 harness `execute.py`가 저장소 루트에서 `git add -A`를 실행하므로, 섞인 브랜치는 남의 프로젝트 변경을 통째로 커밋에 끌고 들어간다.

### slug — 영문 kebab-case 2~4단어

- 소문자 영문과 하이픈만. **한글을 쓰지 마라** — 브랜치명은 터미널·URL·파일경로에 그대로 노출된다. (커밋 메시지는 한글이다. 여기만 영문이다.)
- 이슈·PR 번호를 붙이지 마라. 브랜치를 먼저 만들기 때문에 PR 번호는 아직 존재하지도 않는다.
- **예외 하나** — harness phase 브랜치는 phase 디렉토리 이름을 그대로 쓴다. 숫자로 시작해도 그대로 둔다. 디렉토리명과 브랜치명이 문자 단위로 1:1이어야 어느 브랜치가 어느 phase 실행인지 변환 없이 보인다.

```
feat/spend-report/csv-parse
fix/peerlens/ticker-dedupe
refactor/whiteboard-editor/store-split
chore/repo/branch-skill
exp/whiteboard-editor/docs-on
feat/spend-report/0-initial-release   ← harness phase 예외
```

## 만드는 절차

1. 변경 내용을 보고 type·project·slug를 정한다.

2. 같은 이름이 이미 있는지 본다. 있으면 **거기서 멈춘다.** 접미사(`-2`)를 붙이거나 그 브랜치로 checkout하지 말고, 다른 이름을 제안하고 사용자에게 물어라. 이름이 겹친다는 건 같은 작업을 이미 시작했거나 slug가 뭉뚱그려졌다는 신호이고, 둘 다 사람이 봐야 할 상황이다.

3. origin을 최신화하고 `origin/main`에서 분기한 뒤 즉시 올린다. **로컬 main에서 자르지 마라** — 뒤처진 base 위에서 갈라지면 나중에 충돌로 돌아온다.

```bash
git fetch origin
git checkout -b <type>/<project>/<slug> origin/main
git push -u origin <type>/<project>/<slug>
```

4. PR 초안을 같이 낸다 — 제목 하나와 본문 하나 (아래 두 절).

## squash 커밋 메시지 초안

머지가 squash라 main에는 커밋이 하나 남는다. 그 커밋의 제목은 PR 제목, 본문은 PR 본문이 그대로 들어간다. 제목은 브랜치명에서 유도한다.

```
<type>/<project>/<slug>   →   <type>(<project>): <한글 요약>
```

`feat/spend-report/csv-parse` → `feat(spend-report): 거래내역 CSV를 파싱한다`

- CRITICAL: **scope는 항상 프로젝트명이다.** phase 이름이나 다른 걸 넣지 마라. `feat(0-initial-release):`처럼 phase명이 scope에 새어 들어간 게 과거의 어긋난 사례다. harness phase 브랜치라도 scope는 `spend-report`다.
- 요약은 한글로 쓴다. slug를 그대로 옮겨 적지 마라.
- 브랜치를 만들면서 제목 초안까지 출력한다. 본문은 아래 절에서 함께 낸다.

## PR 본문 초안

제목 한 줄로는 부족하다. **여기 쓰는 본문이 squash 커밋의 본문이 되어 main 히스토리에 그대로 박힌다** — GitHub에만 남는 메모가 아니라 `git log`로 읽히는 영구 기록이다. 제목 초안과 함께 본문 초안도 낸다.

```markdown
## 무엇을

<한 문단. 이 PR이 바꾸는 것을 쓰는 쪽 관점에서.>

## 왜

<이 변경이 필요한 이유. 다른 선택지를 저울질했다면 버린 이유까지.>

## 어떻게 확인했나

- <실제로 돌린 명령·시나리오와 그 결과>

## 남은 것

- <의도적으로 미룬 것, 후속 작업, 알려진 한계. 없으면 이 절을 지운다.>
```

- 한글로 쓴다. 제목에 쓴 어휘를 본문에서도 그대로 쓴다.
- CRITICAL: **"왜"를 생략하지 마라.** "무엇을"은 diff를 보면 알 수 있지만 "왜"는 코드 어디에도 없다. 여기 안 쓰면 그 판단은 어디에도 남지 않는다. 이 저장소는 실험 프로젝트를 모아둔 곳이라 되짚는 시점이 늦고, 그때 읽는 사람은 대개 작성자 자신이다. 대충 쓴 본문도 그대로 main에 박히므로 나중에 고칠 수 없다.
- **확인 방법은 실제로 한 것만 적는다.** 안 돌려봤으면 "검증 안 함"이라고 적어라. 돌렸다고 지어내지 마라.
- 커밋 목록을 옮겨 적지 마라. GitHub PR 페이지에 이미 있다. diff도 붙여 넣지 마라 — 파일은 경로로만 가리킨다 (`spend-report/parser.py:42`).
- harness phase PR은 step 커밋이 수십 개다. **step을 나열하지 말고 그 phase가 무엇을 완성했는지로 쓴다.**
- 길이는 변경 크기에 맞춘다. 오타 수정 PR에 네 절을 채우지 마라 — 제목과 "왜" 한 줄이면 끝이다. 절을 비워두느니 지운다.

초안이 준비되면 **PR까지 연다** (아래 절).

## 작업을 끝낸 뒤

커밋하고 push했으면 **PR을 열고 main으로 돌아간다.**

```bash
git push
gh pr create --base main --title "<제목 초안>" --body-file <본문 초안 파일>
git checkout main
```

- 본문은 파일로 넘긴다. 한글 여러 줄을 `--body`에 직접 넣으면 셸 인용이 깨진다.
- `pull`은 하지 마라. 분기는 항상 `origin/main`에서 하므로 로컬 main이 뒤처져 있어도 다음 작업에 영향이 없다.
- 브랜치를 만들 때 하는 `push -u`(위 3단계) 직후에는 **돌아가지 않는다.** 그때 돌아가면 정작 작업이 main에서 이뤄진다.

**Why:** 다음 작업이 이전 브랜치 위에서 조용히 시작되는 사고를 막는다. 머지된 브랜치는 손으로 지우는데, 그 브랜치에 서 있으면 `git branch -d`가 거부된다.

## main에서 이미 작업 중이라면

CRITICAL: **main에 직접 커밋하지 마라.** 오타 하나도 예외가 아니다.

**Why:** harness `execute.py`가 저장소 루트에서 `git add -A`를 실행한다. main에 손대다 만 변경이 남아 있으면 다음 harness 실행이 그걸 남의 프로젝트 커밋에 통째로 빨아들인다 (`spend-report/CLAUDE.md` 참고).

발동했을 때 이미 main에 변경이 있으면:

- **아직 커밋 전이면** — 그대로 브랜치를 만든다. `git checkout -b`가 미커밋 변경을 새 브랜치로 데려가므로 손실 없이 정리된다. 딸려온 변경이 이번 작업과 무관하면 사용자에게 알리고, 커밋할 때 이번 작업 파일만 `git add` 한다.
- **이미 main에 커밋됐으면** — 손대지 마라. `reset`도 `cherry-pick`도 하지 말고 상황만 보고한다. 되돌리는 건 사용자가 판단할 일이고, 이미 push됐다면 되돌릴 수 없는 사고로 번진다.

## 머지와 삭제

- **squash merge만 쓴다.** GitHub Settings에서 Squash merging만 남기고 merge commit·rebase 버튼은 꺼둔다. 함께 `squash_merge_commit_title=PR_TITLE` · `squash_merge_commit_message=PR_BODY`로 둔다.

  **Why:** main 히스토리를 **결정 기록**으로 쓰기 위해서다. PR 하나가 커밋 하나가 되므로 로그가 "의도" 단위로 읽히고, `Merge pull request #NN` 같은 내용 없는 커밋이 끼지 않는다. 게다가 위 두 설정 덕에 squash 커밋이 PR 본문을 통째로 싣는다 — 브랜치 안의 중간 커밋을 접는 대신 **"왜"를 얻는다.** `git log`만으로 판단 근거를 되짚을 수 있고 GitHub 없이도 읽힌다.

  이 규칙은 저장소 전체에 걸린다. 머지 방식은 GitHub에서 저장소 단위로만 정할 수 있어 프로젝트별로 다르게 둘 수 없다.

  **가장 극단적인 사례가 harness다.** step마다 커밋이 하나씩 쌓여 phase 하나에 수십 개가 된다. 기계가 찍은 중간 저장이라 main에 펼쳐둘 이유가 없다. 다만 harness를 쓰지 않는 프로젝트에도 위의 근거는 그대로 성립한다.

  **잃는 것:** 의도적으로 나눈 커밋도 하나로 접힌다. 그건 PR 본문이 대신 설명한다 — 그래서 본문에 "왜"를 쓰는 것이 CRITICAL이다. 중간 커밋 자체는 GitHub PR 페이지에 그대로 남는다.

- 머지되면 로컬·원격 브랜치를 **손으로** 지운다.

```bash
git branch -d <branch> && git push origin --delete <branch>
```

- GitHub의 **"Automatically delete head branches"는 켜지 마라.** 브랜치 이름을 보지 못해서 아래 `exp/` 예외를 지킬 수 없다.

## exp/ — 실험 브랜치

`exp/`는 서로 비교하려고 만드는 브랜치다. 보통 짝을 이룬다 (`exp/whiteboard-editor/docs-on` ↔ `docs-off`).

- 채택된 쪽만 main으로 머지한다.
- 머지한 뒤에도 **짝을 통째로 남긴다.** 승자도 지우지 않는다.
- 실험 결과가 저장소에 문서로 들어오면(`whiteboard-editor/DOC-AB-RESULT.md` 같은) 그때 짝을 전부 지운다.

  **Why:** 브랜치를 남기는 이유는 결론이 아직 글로 안 남았다는 것 하나다. 문서가 생기면 수명도 끝난다.

## 적용 범위

이 규칙은 **앞으로 만드는 브랜치에만** 적용된다. 이미 있는 브랜치를 규칙에 맞춰 이름을 바꾸거나 지우려 들지 마라.
