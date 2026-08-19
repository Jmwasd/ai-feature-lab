#!/usr/bin/env python3
"""세션 트랜스크립트(JSONL)를 읽을 수 있는 마크다운 대화 로그로 변환한다.

사용법:
    # SessionEnd hook에서 (stdin으로 transcript_path를 받는다)
    python3 scripts/session-log.py

    # 특정 트랜스크립트 지정
    python3 scripts/session-log.py --transcript ~/.claude/projects/<slug>/<id>.jsonl

    # 이 프로젝트의 최신 세션
    python3 scripts/session-log.py --latest

    # 과거 세션 일괄 변환
    python3 scripts/session-log.py --all

출력: docs/logs/<날짜>-<세션 앞 8자>.md (같은 세션이면 덮어쓴다)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT_DIR = REPO_ROOT / "docs" / "logs"
PROJECTS_DIR = Path.home() / ".claude" / "projects"
KST = timezone(timedelta(hours=9))

SYSTEM_REMINDER_RE = re.compile(r"<system-reminder>.*?</system-reminder>\s*", re.DOTALL)
COMMAND_NAME_RE = re.compile(r"<command-name>(.*?)</command-name>", re.DOTALL)

# 사용자 입력으로 보이지만 실제로는 하네스가 끼워 넣은 텍스트다.
SKIP_USER_PREFIXES = (
    "<local-command-stdout>",
    "<local-command-caveat>",
    "<command-message>",
    "<command-args>",
    "[Request interrupted",
    "API Error",
)


def project_dir_for(repo: Path) -> Path:
    """cwd를 Claude Code의 프로젝트 디렉터리 슬러그로 변환한다."""
    slug = str(repo).replace("/", "-").replace(".", "-").replace("_", "-")
    return PROJECTS_DIR / slug


def find_transcripts(repo: Path) -> list[Path]:
    """이 저장소(및 상위 디렉터리)에 연결된 트랜스크립트를 최신순으로 반환한다."""
    candidates: list[Path] = []
    for base in [repo, *repo.parents]:
        d = project_dir_for(base)
        if d.is_dir():
            candidates.extend(d.glob("*.jsonl"))
    return sorted(set(candidates), key=lambda p: p.stat().st_mtime, reverse=True)


def clean_user_text(raw: str) -> str | None:
    text = SYSTEM_REMINDER_RE.sub("", raw).strip()
    if not text:
        return None

    command = COMMAND_NAME_RE.search(text)
    if command:
        return f"`{command.group(1).strip()}` (슬래시 커맨드)"

    if text.startswith(SKIP_USER_PREFIXES):
        return None
    return text


def summarize_tool(name: str, tool_input: dict) -> str:
    """도구 호출을 한 줄로 압축한다. 전체 인자·출력은 남기지 않는다."""
    if name == "Bash":
        first_line = str(tool_input.get("command", "")).strip().splitlines()
        detail = first_line[0] if first_line else ""
    elif name in {"Read", "Write", "Edit", "NotebookEdit"}:
        detail = str(tool_input.get("file_path", ""))
    elif name in {"Grep", "Glob"}:
        detail = str(tool_input.get("pattern", ""))
    elif name in {"WebFetch", "WebSearch"}:
        detail = str(tool_input.get("url") or tool_input.get("query", ""))
    elif name in {"Task", "Agent"}:
        detail = str(tool_input.get("description", ""))
    elif name == "Skill":
        detail = str(tool_input.get("skill", ""))
    else:
        detail = str(tool_input.get("description") or tool_input.get("prompt") or "")

    detail = " ".join(detail.split())
    if len(detail) > 120:
        detail = detail[:117] + "..."
    return f"{name}: {detail}" if detail else name


def parse(transcript: Path) -> tuple[list[dict], dict]:
    """대화 턴과 세션 메타데이터를 뽑아낸다."""
    turns: list[dict] = []
    meta: dict = {"session": transcript.stem}

    for line in transcript.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue

        if row.get("type") not in {"user", "assistant"}:
            continue
        if row.get("isSidechain") or row.get("isMeta"):
            continue  # 서브에이전트 대화와 하네스 메타 메시지는 제외

        meta.setdefault("branch", row.get("gitBranch"))
        meta.setdefault("cwd", row.get("cwd"))
        meta.setdefault("started", row.get("timestamp"))
        meta["ended"] = row.get("timestamp") or meta.get("ended")

        message = row.get("message") or {}
        content = message.get("content")
        timestamp = row.get("timestamp")

        if row["type"] == "user":
            if isinstance(content, str):
                raw = content
            elif isinstance(content, list):
                parts = [b.get("text", "") for b in content if b.get("type") == "text"]
                if not parts:
                    continue  # tool_result만 있는 턴
                raw = "\n".join(parts)
            else:
                continue

            text = clean_user_text(raw)
            if text:
                turns.append({"role": "user", "text": text, "ts": timestamp})
            continue

        # assistant
        meta.setdefault("model", message.get("model"))
        if not isinstance(content, list):
            continue

        texts = [b["text"].strip() for b in content if b.get("type") == "text" and b.get("text", "").strip()]
        tools = [summarize_tool(b.get("name", "?"), b.get("input") or {}) for b in content if b.get("type") == "tool_use"]
        if not texts and not tools:
            continue  # thinking 전용 블록은 기록하지 않는다

        if turns and turns[-1]["role"] == "assistant":
            prev = turns[-1]
            prev["texts"].extend(texts)
            prev["tools"].extend(tools)
        else:
            turns.append({"role": "assistant", "texts": texts, "tools": tools, "ts": timestamp})

    return turns, meta


def demote_headings(text: str) -> str:
    """본문 헤딩을 낮춰 로그 자체의 문서 구조(## 질문 / ### 답변)를 지킨다."""
    out: list[str] = []
    in_fence = False
    for line in text.splitlines():
        if line.lstrip().startswith(("```", "~~~")):
            in_fence = not in_fence
            out.append(line)
            continue
        if not in_fence:
            match = re.match(r"^(#{1,6}) (.*)$", line)
            if match:
                level = min(len(match.group(1)) + 3, 6)
                out.append(f"{'#' * level} {match.group(2)}")
                continue
        out.append(line)
    return "\n".join(out)


def fmt_time(iso: str | None) -> str:
    if not iso:
        return ""
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(KST)
    except ValueError:
        return ""
    return dt.strftime("%H:%M")


def render(turns: list[dict], meta: dict) -> str:
    started = meta.get("started")
    try:
        date = datetime.fromisoformat(started.replace("Z", "+00:00")).astimezone(KST).strftime("%Y-%m-%d")
    except (AttributeError, ValueError):
        date = "unknown"

    lines = [f"# 대화 로그 {date}", ""]
    for label, value in (
        ("세션", meta.get("session", "")[:8]),
        ("브랜치", meta.get("branch")),
        ("모델", meta.get("model")),
        ("시간", f"{fmt_time(meta.get('started'))} – {fmt_time(meta.get('ended'))} KST"),
    ):
        if value:
            lines.append(f"- {label}: {value}")
    lines.append("")

    for turn in turns:
        stamp = fmt_time(turn.get("ts"))
        if turn["role"] == "user":
            lines += ["---", "", f"## 질문 · {stamp}".rstrip(" ·"), "", demote_headings(turn["text"]), ""]
            continue

        lines += [f"### 답변 · {stamp}".rstrip(" ·"), ""]
        for text in turn["texts"]:
            lines += [demote_headings(text), ""]
        if turn["tools"]:
            lines += ["<details>", f"<summary>도구 호출 {len(turn['tools'])}건</summary>", ""]
            lines += [f"- `{tool}`" for tool in turn["tools"]]
            lines += ["", "</details>", ""]

    return "\n".join(lines).rstrip() + "\n"


def write_log(transcript: Path, out_dir: Path) -> Path | None:
    turns, meta = parse(transcript)
    if not turns:
        return None

    started = meta.get("started")
    try:
        date = datetime.fromisoformat(started.replace("Z", "+00:00")).astimezone(KST).strftime("%Y-%m-%d")
    except (AttributeError, ValueError):
        date = "unknown"

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{date}-{transcript.stem[:8]}.md"
    out_path.write_text(render(turns, meta), encoding="utf-8")
    return out_path


def transcript_from_stdin() -> Path | None:
    if sys.stdin.isatty():
        return None
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        return None
    path = payload.get("transcript_path")
    return Path(path).expanduser() if path else None


def main() -> int:
    parser = argparse.ArgumentParser(description="세션 트랜스크립트를 마크다운 대화 로그로 변환한다")
    parser.add_argument("--transcript", type=Path, help="변환할 JSONL 경로")
    parser.add_argument("--latest", action="store_true", help="이 저장소의 최신 세션을 변환한다")
    parser.add_argument("--all", action="store_true", help="이 저장소의 모든 세션을 변환한다")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR, help=f"출력 디렉터리 (기본: {DEFAULT_OUT_DIR})")
    args = parser.parse_args()

    if args.transcript:
        targets = [args.transcript]
    elif args.all:
        targets = find_transcripts(REPO_ROOT)
    elif args.latest:
        targets = find_transcripts(REPO_ROOT)[:1]
    else:
        stdin_path = transcript_from_stdin()
        targets = [stdin_path] if stdin_path else find_transcripts(REPO_ROOT)[:1]

    targets = [t for t in targets if t and t.is_file()]
    if not targets:
        print("변환할 트랜스크립트를 찾지 못했다", file=sys.stderr)
        return 1

    for transcript in targets:
        out_path = write_log(transcript, args.out)
        if out_path:
            print(f"기록: {out_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
