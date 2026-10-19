---
name: chat-logs
description: 프로젝트명을 받아 그 프로젝트에서 나눈 Claude Code 대화 전체를 질문·답변만 남긴 HTML 한 장으로 묶는다. "/chat-logs <프로젝트명>", "/cl <프로젝트명>", "대화 기록 뽑아줘", "지금까지 나눈 질문이랑 답변 정리해줘", "세션 로그 HTML로 만들어줘" 같은 요청에 쓴다.
argument-hint: "[프로젝트명]"
allowed-tools: Bash(python3 ${CLAUDE_SKILL_DIR}/build_chat_logs.py *)
---

# chat-logs

`$ARGUMENTS` 가 프로젝트 폴더명이다 (예: `peerlens`).

## 실행

```bash
python3 ${CLAUDE_SKILL_DIR}/build_chat_logs.py $ARGUMENTS
```

인자가 비어 있으면 프로젝트명을 지어내지 말고 목록부터 보여준 뒤 사용자에게 물어라.

```bash
python3 ${CLAUDE_SKILL_DIR}/build_chat_logs.py --list
```

모노레포 루트에서 연 세션은 질문·답변에 프로젝트 이름이 나오면 자동으로 포함된다. 다른 cwd에서 진행했는데 프로젝트 이름이 한 번도 나오지 않아 빠진 세션만 세션 ID(앞부분 가능)로 지정해 넣는다. 여러 번 쓸 수 있다.

```bash
python3 ${CLAUDE_SKILL_DIR}/build_chat_logs.py $ARGUMENTS --session <세션ID>
```

프로젝트와 무관한 대화(개인 정보가 담긴 작업 등)는 질문 앞부분으로 뺀다. 여러 번 쓸 수 있다.

```bash
python3 ${CLAUDE_SKILL_DIR}/build_chat_logs.py $ARGUMENTS --exclude "<질문 앞부분>"
```

## 규칙

- **HTML을 직접 작성하지 마라.** 생성기는 이 스크립트 하나다. 결과가 마음에 안 들면 스크립트를 고치고 다시 실행하라. 손으로 HTML을 쓰면 다음 실행에서 덮어써진다.
- **질문·답변 문장을 요약하거나 다듬지 마라.** 이 도구의 목적은 원문 보존이다. 걷어내는 것은 도구 호출, thinking, 시스템 메시지, 슬래시 커맨드, 하네스 삽입 블록, 서브에이전트 대화뿐이다.
- 스크립트가 후보가 여러 개라고 알리면 임의로 하나를 고르지 말고 사용자에게 어느 경로인지 물어라.
- 끝나면 생성된 파일마다 경로와 `세션 N개 · 질문 M개`를 그대로 사용자에게 알려라.

## 동작 요약

**소스는 둘이다.** 하나만 보면 기록이 절반만 남는다 — harness가 codex로 도는 프로젝트가 특히 그렇다.

```
~/.claude/projects/   Claude Code 트랜스크립트
~/.codex/sessions/    Codex CLI 트랜스크립트
```

1. `~/.claude/projects/` 의 세션 디렉터리를 훑어 각 트랜스크립트의 `cwd`를 읽고, **폴더명이 인자와 정확히 일치하는** 프로젝트를 찾는다. 슬러그는 `/`·`.`·`_`를 모두 `-`로 바꿔 만들어져 역산이 모호하므로 `cwd`가 유일하게 믿을 수 있는 출처다.
2. 그 디렉터리의 모든 `*.jsonl` 을 세션 시작 시각 순으로 읽는다.
3. 나머지 Claude Code 세션 디렉터리와 `~/.codex/sessions/` 를 전수로 읽어 같은 프로젝트의 세션을 더한다. 귀속 규칙은 두 소스 모두 같다:
   - `cwd` 의 폴더명이 프로젝트명과 일치하면 포함한다.
   - `cwd` 가 프로젝트의 **상위** 경로(모노레포 루트)면, **질문이나 답변이 그 프로젝트 이름을 가리킬 때만** 포함한다. 루트 cwd 하나에 여러 프로젝트 작업이 섞이므로 전부 가져오면 남의 대화가 딸려온다. 답변까지 보는 이유는 설계 초기 세션 때문이다 — 폴더를 만들기 전이라 질문에는 이름이 없고 답변에만 나온다.
4. 질문·답변 쌍만 남긴다. 짝이 없는 쪽(답변 없는 질문, 질문 없는 답변)은 버린다.
   - Codex는 주입 지시문도 `user` 롤로 기록한다. `developer` 롤, `<recommended_plugins>` 류 블록, `AGENTS.md` 지시문, harness `execute.py` 프리앰블(`당신은 ... 프로젝트의 개발자입니다.`)은 걷어낸다.
   - harness가 Codex로 돌린 비대화형 세션은 사람 발화가 없어 자동으로 빠진다.
   - harness가 Claude Code로 돌린 step 세션은 첫 질문이 `당신은 ... 프로젝트의 개발자입니다.` 로 시작한다. 사람이 나눈 대화와 섞이지 않게 이런 세션은 별도 파일로 뺀다(6번).
5. 두 소스를 세션 시작 시각 순으로 합친다. 각 세션 헤더에 `Claude Code` / `Codex` 를 표기한다.
6. 출력은 `<프로젝트 경로>/docs/logs/` 아래 두 파일이다. 둘 다 왼쪽 사이드 목차(날짜 → 세션 → 질문) + 본문 한 장이고, 다시 실행하면 덮어쓴다.
   - `<프로젝트명>-qa.html` — 사람이 나눈 대화
   - `<프로젝트명>-qa-harness.html` — harness step 세션(원문 그대로). 해당 세션이 없으면 만들지 않는다.
7. `--json <경로>`를 주면 사람이 나눈 대화를 앱에서 렌더링할 JSON으로도 쓴다. 본문은 HTML과 같은 변환기를 거친 HTML 조각이라 두 출력이 어긋나지 않는다. 경로는 프로젝트가 정한다(예: 앱 페이지가 import하는 데이터 파일). 이 JSON도 손으로 고치지 말고 다시 생성한다.

## 다른 프로젝트로 옮길 때

이 스킬 폴더를 `~/.claude/skills/` 로 통째로 복사하면 어느 폴더에서든 `/chat-logs <프로젝트명>` 이 동작한다. 스크립트는 저장소 상대 경로를 쓰지 않고 `~/.claude/projects/`·`~/.codex/sessions/` 와 트랜스크립트의 `cwd` 만 참조한다. `/cl` 별칭도 쓰려면 `.claude/commands/cl.md` 를 `~/.claude/commands/` 로 함께 복사하라.
