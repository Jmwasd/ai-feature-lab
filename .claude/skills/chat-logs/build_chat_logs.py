#!/usr/bin/env python3
"""프로젝트의 Claude Code 세션 전체를 질문·답변만 남긴 HTML 한 장으로 묶는다.

사용법:
    python3 build_chat_logs.py peerlens          # 프로젝트명으로 세션을 찾아 HTML 생성
    python3 build_chat_logs.py --list            # 변환 가능한 프로젝트 목록
    python3 build_chat_logs.py peerlens --out /경로/파일.html

출력: <프로젝트 경로>/docs/logs/<프로젝트명>-qa.html (다시 실행하면 덮어쓴다)

원칙: 질문·답변 문장은 손대지 않는다. 도구 호출, thinking, 시스템 메시지,
슬래시 커맨드, 서브에이전트 대화 같은 노이즈만 걷어낸다.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECTS_DIR = Path.home() / ".claude" / "projects"
KST = timezone(timedelta(hours=9))

# 사용자 입력처럼 보이지만 실제로는 하네스가 끼워 넣은 블록이다.
# 블록만 도려내고 나머지는 남긴다. 슬래시 커맨드 뒤에 진짜 질문이 이어붙는 경우가
# 흔해서, 통째로 버리면 질문까지 잃는다.
HARNESS_TAGS = (
    "system-reminder",
    "local-command-caveat",
    "local-command-stdout",
    "command-name",
    "command-message",
    "command-args",
    "task-notification",
    "bash-input",
    "bash-stdout",
    "bash-stderr",
)
HARNESS_BLOCK_RE = re.compile(
    r"<(" + "|".join(HARNESS_TAGS) + r")\b[^>]*>.*?</\1>\s*", re.DOTALL
)
HARNESS_OPEN_RE = re.compile(r"^<(" + "|".join(HARNESS_TAGS) + r")\b")
NOISE_LINE_RE = re.compile(r"^\s*(?:\[Request interrupted[^\n]*|API Error[^\n]*)$", re.MULTILINE)


# ---------------------------------------------------------------- 세션 찾기


def session_dirs() -> list[Path]:
    if not PROJECTS_DIR.is_dir():
        return []
    return sorted(d for d in PROJECTS_DIR.iterdir() if d.is_dir() and any(d.glob("*.jsonl")))


def cwd_of(directory: Path) -> str | None:
    """디렉터리 안의 트랜스크립트에서 실제 작업 경로를 읽는다.

    슬러그는 `/`·`.`·`_`를 모두 `-`로 바꿔 만들어져 역산이 모호하다.
    JSONL에 기록된 cwd가 유일하게 정확한 출처다.
    """
    found: Counter[str] = Counter()
    for transcript in sorted(directory.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True):
        for line in read_lines(transcript, limit=200):
            cwd = line.get("cwd")
            if cwd:
                found[cwd] += 1
                break
        if found:
            break
    return found.most_common(1)[0][0] if found else None


def read_lines(transcript: Path, limit: int | None = None):
    try:
        handle = transcript.open(encoding="utf-8")
    except OSError:
        return
    with handle:
        for index, line in enumerate(handle):
            if limit is not None and index >= limit:
                return
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def find_project(name: str) -> tuple[Path, str] | list[tuple[Path, str]]:
    """프로젝트명과 폴더명이 일치하는 세션 디렉터리를 찾는다.

    일치가 하나면 (세션 디렉터리, 프로젝트 경로)를, 여럿이면 후보 목록을 돌려준다.
    """
    matches: list[tuple[Path, str]] = []
    fallback: list[tuple[Path, str]] = []
    normalized = name.replace("/", "-").replace(".", "-").replace("_", "-")

    for directory in session_dirs():
        cwd = cwd_of(directory)
        if cwd and Path(cwd).name == name:
            matches.append((directory, cwd))
        elif not cwd and directory.name.endswith(f"-{normalized}"):
            # cwd를 못 읽은 경우에만 슬러그 끝자락으로 폴백한다.
            fallback.append((directory, ""))

    found = matches or fallback
    if len(found) == 1:
        return found[0]
    return found


# ---------------------------------------------------------------- 파싱


def clean_user_text(raw: str) -> str | None:
    text = HARNESS_BLOCK_RE.sub("", raw)
    text = NOISE_LINE_RE.sub("", text).strip()
    if not text:
        return None
    if HARNESS_OPEN_RE.match(text):
        return None  # 닫는 태그가 잘려 블록으로 못 지운 경우
    return text


def parse_session(transcript: Path) -> tuple[list[dict], dict]:
    """트랜스크립트에서 질문·답변 쌍과 세션 메타데이터를 뽑는다."""
    turns: list[dict] = []
    meta: dict = {"session": transcript.stem}

    for row in read_lines(transcript):
        if row.get("type") not in {"user", "assistant"}:
            continue
        if row.get("isSidechain") or row.get("isMeta"):
            continue  # 서브에이전트 대화와 하네스 메타 메시지는 제외

        meta.setdefault("branch", row.get("gitBranch"))
        meta.setdefault("cwd", row.get("cwd"))
        meta.setdefault("started", row.get("timestamp"))
        if row.get("timestamp"):
            meta["ended"] = row["timestamp"]

        message = row.get("message") or {}
        content = message.get("content")
        timestamp = row.get("timestamp")

        if row["type"] == "user":
            if isinstance(content, str):
                raw = content
            elif isinstance(content, list):
                parts = [b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"]
                if not parts:
                    continue  # tool_result만 있는 턴
                raw = "\n".join(parts)
            else:
                continue

            text = clean_user_text(raw)
            if not text:
                continue

            if turns and turns[-1]["role"] == "user":
                # 인터럽트로 같은 질문이 두 번 찍히면 하나로 본다.
                if turns[-1]["text"].strip() != text.strip():
                    turns[-1]["text"] += "\n\n" + text
                continue

            turns.append({"role": "user", "text": text, "ts": timestamp})
            continue

        meta.setdefault("model", message.get("model"))
        if not isinstance(content, list):
            continue

        texts = [
            b["text"].strip()
            for b in content
            if isinstance(b, dict) and b.get("type") == "text" and b.get("text", "").strip()
        ]
        if not texts:
            continue  # 도구 호출·thinking만 있는 턴은 남기지 않는다

        if turns and turns[-1]["role"] == "assistant":
            turns[-1]["texts"].extend(texts)
        else:
            turns.append({"role": "assistant", "texts": texts, "ts": timestamp})

    return pair_turns(turns), meta


def pair_turns(turns: list[dict]) -> list[dict]:
    """질문 하나에 답변 하나를 붙인다. 짝이 없는 쪽은 버린다."""
    pairs: list[dict] = []
    pending: dict | None = None

    for turn in turns:
        if turn["role"] == "user":
            pending = turn
            continue
        if pending is None:
            continue  # 질문 없이 나온 답변은 제외

        answer = "\n\n".join(turn["texts"])
        if pairs and pairs[-1]["question"].strip() == pending["text"].strip():
            # 인터럽트 뒤 같은 질문을 다시 보낸 경우다. 질문은 하나로 두되
            # 중간에 나온 답변은 버리지 않고 이어 붙인다.
            pairs[-1]["answer"] += "\n\n" + answer
            pairs[-1]["answered"] = turn.get("ts")
            pending = None
            continue

        pairs.append(
            {
                "question": pending["text"],
                "answer": answer,
                "asked": pending.get("ts"),
                "answered": turn.get("ts"),
            }
        )
        pending = None

    return pairs


# ---------------------------------------------------------------- 마크다운


INLINE_CODE_RE = re.compile(r"`([^`]+)`")
BOLD_RE = re.compile(r"\*\*([^*]+)\*\*")
ITALIC_RE = re.compile(r"(?<![*\w])\*([^*\n]+)\*(?![*\w])")
LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
BULLET_RE = re.compile(r"^\s*[-*+]\s+(.*)$")
ORDERED_RE = re.compile(r"^\s*\d+[.)]\s+(.*)$")
QUOTE_RE = re.compile(r"^\s*>\s?(.*)$")
TABLE_SEP_RE = re.compile(r"^\s*\|?[\s:|-]+\|[\s:|-]*$")


def inline(text: str) -> str:
    """인라인 마크다운만 HTML로 바꾼다. 코드 스팬 안은 건드리지 않는다."""
    escaped = html.escape(text)
    stash: list[str] = []

    def keep(match: re.Match[str]) -> str:
        stash.append(match.group(1))
        return f"\x00{len(stash) - 1}\x00"

    escaped = INLINE_CODE_RE.sub(keep, escaped)
    escaped = LINK_RE.sub(r'<a href="\2" rel="noreferrer">\1</a>', escaped)
    escaped = BOLD_RE.sub(r"<strong>\1</strong>", escaped)
    escaped = ITALIC_RE.sub(r"<em>\1</em>", escaped)
    return re.sub(r"\x00(\d+)\x00", lambda m: f"<code>{stash[int(m.group(1))]}</code>", escaped)


def split_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def md_to_html(text: str) -> str:
    lines = text.split("\n")
    out: list[str] = []
    buffer: list[str] = []
    index = 0

    def flush() -> None:
        if buffer:
            out.append("<p>" + "<br>".join(inline(line) for line in buffer) + "</p>")
            buffer.clear()

    while index < len(lines):
        line = lines[index]
        stripped = line.strip()

        if stripped.startswith("```") or stripped.startswith("~~~"):
            flush()
            fence = stripped[:3]
            index += 1
            code: list[str] = []
            while index < len(lines) and not lines[index].strip().startswith(fence):
                code.append(lines[index])
                index += 1
            index += 1
            out.append("<pre><code>" + html.escape("\n".join(code)) + "</code></pre>")
            continue

        if not stripped:
            flush()
            index += 1
            continue

        heading = HEADING_RE.match(line)
        if heading:
            flush()
            out.append(f'<p class="mdh">{inline(heading.group(2))}</p>')
            index += 1
            continue

        if stripped in {"---", "***", "___"}:
            flush()
            out.append("<hr>")
            index += 1
            continue

        if stripped.startswith("|") and index + 1 < len(lines) and TABLE_SEP_RE.match(lines[index + 1]):
            flush()
            header = split_row(line)
            index += 2
            rows: list[list[str]] = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                rows.append(split_row(lines[index]))
                index += 1
            head = "".join(f"<th>{inline(cell)}</th>" for cell in header)
            body = "".join(
                "<tr>" + "".join(f"<td>{inline(cell)}</td>" for cell in row) + "</tr>" for row in rows
            )
            out.append(f"<div class='tw'><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>")
            continue

        if BULLET_RE.match(line) or ORDERED_RE.match(line):
            flush()
            ordered = ORDERED_RE.match(line) is not None
            pattern = ORDERED_RE if ordered else BULLET_RE
            items: list[str] = []
            while index < len(lines):
                match = pattern.match(lines[index])
                if not match:
                    break
                items.append(f"<li>{inline(match.group(1))}</li>")
                index += 1
            tag = "ol" if ordered else "ul"
            out.append(f"<{tag}>{''.join(items)}</{tag}>")
            continue

        if QUOTE_RE.match(line):
            flush()
            quoted: list[str] = []
            while index < len(lines):
                match = QUOTE_RE.match(lines[index])
                if not match:
                    break
                quoted.append(inline(match.group(1)))
                index += 1
            out.append("<blockquote>" + "<br>".join(quoted) + "</blockquote>")
            continue

        buffer.append(line)
        index += 1

    flush()
    return "\n".join(out)


# ---------------------------------------------------------------- 렌더링


def to_kst(iso: str | None) -> datetime | None:
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(KST)
    except (AttributeError, ValueError):
        return None


def fmt_date(iso: str | None) -> str:
    dt = to_kst(iso)
    return dt.strftime("%Y-%m-%d") if dt else "날짜 미상"


def fmt_time(iso: str | None) -> str:
    dt = to_kst(iso)
    return dt.strftime("%H:%M") if dt else ""


def summarize(question: str, limit: int = 68) -> str:
    """목차에 걸 한 줄 제목을 만든다."""
    for line in question.split("\n"):
        text = " ".join(line.split())
        if text:
            return text if len(text) <= limit else text[: limit - 1] + "…"
    return "(빈 질문)"


CSS = """
:root {
  --bg: #ffffff; --panel: #f6f7f9; --line: #e3e6ea; --line-2: #d3d8de;
  --fg: #1b1f24; --fg-2: #576070; --fg-3: #7d8798;
  --accent: #2f6fd0; --q-bg: #eef3fb; --q-line: #2f6fd0; --code-bg: #f0f2f5;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1115; --panel: #14171c; --line: #242a31; --line-2: #2f363f;
    --fg: #e6e8eb; --fg-2: #a3adbb; --fg-3: #79828f;
    --accent: #7aa2f7; --q-bg: #172033; --q-line: #7aa2f7; --code-bg: #191d23;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard",
    "Segoe UI", "Noto Sans KR", sans-serif;
  font-size: 15px; line-height: 1.7;
}
.layout { display: flex; align-items: flex-start; }
aside {
  position: sticky; top: 0; flex: 0 0 300px; height: 100vh; overflow-y: auto;
  background: var(--panel); border-right: 1px solid var(--line); padding: 24px 20px;
}
aside h1 { margin: 0 0 4px; font-size: 17px; letter-spacing: -0.01em; }
aside .meta { margin: 0 0 20px; font-size: 12.5px; color: var(--fg-3); font-variant-numeric: tabular-nums; }
aside details { margin-bottom: 10px; }
aside summary {
  cursor: pointer; font-size: 13px; font-weight: 600; color: var(--fg-2);
  padding: 4px 0; font-variant-numeric: tabular-nums; list-style: none;
}
aside summary::-webkit-details-marker { display: none; }
aside summary::before { content: "▸ "; color: var(--fg-3); }
aside details[open] > summary::before { content: "▾ "; }
aside .sess { margin: 8px 0 4px 14px; font-size: 11.5px; color: var(--fg-3); font-variant-numeric: tabular-nums; }
aside nav a {
  display: block; margin-left: 14px; padding: 3px 8px 3px 10px;
  border-left: 2px solid var(--line-2); color: var(--fg-2);
  font-size: 12.5px; line-height: 1.5; text-decoration: none;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
aside nav a:hover { color: var(--accent); border-left-color: var(--accent); background: var(--bg); }
aside nav a .t { color: var(--fg-3); margin-right: 7px; font-variant-numeric: tabular-nums; }
main { flex: 1 1 auto; min-width: 0; padding: 40px 48px 120px; max-width: 900px; }
main > h1 { margin: 0 0 6px; font-size: 26px; letter-spacing: -0.02em; }
main > .lead { margin: 0 0 44px; color: var(--fg-3); font-size: 13.5px; font-variant-numeric: tabular-nums; }
.session { margin-bottom: 56px; }
.session > header { border-bottom: 1px solid var(--line); padding-bottom: 10px; margin-bottom: 28px; }
.session > header h2 { margin: 0; font-size: 19px; letter-spacing: -0.01em; }
.session > header .meta { margin: 4px 0 0; font-size: 12.5px; color: var(--fg-3); font-variant-numeric: tabular-nums; }
.qa { margin-bottom: 36px; scroll-margin-top: 20px; }
.turn { display: grid; grid-template-columns: 42px 1fr; gap: 12px; }
.turn + .turn { margin-top: 14px; }
.label {
  font-size: 11px; font-weight: 700; letter-spacing: 0.04em; color: var(--fg-3);
  padding-top: 4px; user-select: none;
}
.label .stamp { display: block; font-weight: 400; margin-top: 2px; }
.q .label { color: var(--q-line); }
.q .body {
  background: var(--q-bg); border-left: 2px solid var(--q-line);
  padding: 12px 16px; border-radius: 0 6px 6px 0;
}
.q .body p { font-weight: 500; }
.body > *:first-child { margin-top: 0; }
.body > *:last-child { margin-bottom: 0; }
.body p { margin: 0 0 12px; }
.body .mdh { font-weight: 700; margin: 20px 0 8px; }
.body ul, .body ol { margin: 0 0 12px; padding-left: 22px; }
.body li { margin-bottom: 4px; }
.body blockquote {
  margin: 0 0 12px; padding: 2px 14px; border-left: 2px solid var(--line-2); color: var(--fg-2);
}
.body hr { border: 0; border-top: 1px solid var(--line); margin: 20px 0; }
.body code {
  background: var(--code-bg); border: 1px solid var(--line);
  padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.87em;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
}
.body pre {
  background: var(--code-bg); border: 1px solid var(--line); border-radius: 6px;
  padding: 12px 14px; overflow-x: auto; margin: 0 0 12px;
}
.body pre code { background: none; border: 0; padding: 0; font-size: 12.5px; line-height: 1.6; }
.body a { color: var(--accent); }
.tw { overflow-x: auto; margin: 0 0 12px; }
.body table { border-collapse: collapse; font-size: 13.5px; }
.body th, .body td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; }
.body th { background: var(--code-bg); font-weight: 600; }
.stamp { font-size: 11.5px; color: var(--fg-3); font-variant-numeric: tabular-nums; }
@media (max-width: 900px) {
  .layout { display: block; }
  aside { position: static; width: auto; height: auto; border-right: 0; border-bottom: 1px solid var(--line); }
  main { padding: 28px 20px 80px; }
  .turn { grid-template-columns: 1fr; gap: 6px; }
  .label { padding-top: 0; }
}
"""


def render(project: str, sessions: list[dict]) -> str:
    total = sum(len(s["pairs"]) for s in sessions)
    generated = datetime.now(KST).strftime("%Y-%m-%d %H:%M")

    by_date: dict[str, list[dict]] = {}
    for session in sessions:
        by_date.setdefault(fmt_date(session["meta"].get("started")), []).append(session)

    toc: list[str] = []
    for date, group in by_date.items():
        count = sum(len(s["pairs"]) for s in group)
        links: list[str] = [f'<summary>{html.escape(date)} · {count}</summary>']
        for session in group:
            sid = session["sid"]
            if len(group) > 1 or len(sessions) > 1:
                links.append(f'<div class="sess">{html.escape(sid)}</div>')
            for number, pair in enumerate(session["pairs"], start=1):
                title = html.escape(summarize(pair["question"]))
                stamp = fmt_time(pair.get("asked"))
                links.append(
                    f'<a href="#{sid}-q{number}" title="{title}">'
                    f'<span class="t">{stamp}</span>{title}</a>'
                )
        toc.append(f'<details open>{"".join(links)}</details>')

    body: list[str] = []
    for session in sessions:
        meta = session["meta"]
        sid = session["sid"]
        stamps = [f'{fmt_time(meta.get("started"))}–{fmt_time(meta.get("ended"))} KST']
        if meta.get("branch"):
            stamps.append(str(meta["branch"]))
        if meta.get("model"):
            stamps.append(str(meta["model"]))
        stamps.append(f'질문 {len(session["pairs"])}개')

        entries: list[str] = [
            "<section class='session'>",
            "<header>",
            f'<h2 id="{sid}">{html.escape(fmt_date(meta.get("started")))} <span class="stamp">{html.escape(sid)}</span></h2>',
            f'<p class="meta">{html.escape(" · ".join(stamps))}</p>',
            "</header>",
        ]
        for number, pair in enumerate(session["pairs"], start=1):
            entries.append(f'<article class="qa" id="{sid}-q{number}">')
            entries.append(
                '<div class="turn q">'
                f'<div class="label">Q<span class="stamp">{fmt_time(pair.get("asked"))}</span></div>'
                f'<div class="body">{md_to_html(pair["question"])}</div></div>'
            )
            entries.append(
                '<div class="turn a"><div class="label">A</div>'
                f'<div class="body">{md_to_html(pair["answer"])}</div></div>'
            )
            entries.append("</article>")
        entries.append("</section>")
        body.append("\n".join(entries))

    name = html.escape(project)
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{name} 대화 기록</title>
<style>{CSS}</style>
</head>
<body>
<div class="layout">
<aside>
  <h1>{name}</h1>
  <p class="meta">세션 {len(sessions)}개 · 질문 {total}개</p>
  <nav>{"".join(toc)}</nav>
</aside>
<main>
  <h1>{name} 대화 기록</h1>
  <p class="lead">세션 {len(sessions)}개 · 질문 {total}개 · {generated} 생성</p>
  {"".join(body)}
</main>
</div>
</body>
</html>
"""


# ---------------------------------------------------------------- 진입점


def print_projects() -> None:
    print("변환 가능한 프로젝트:")
    for directory in session_dirs():
        cwd = cwd_of(directory)
        count = len(list(directory.glob("*.jsonl")))
        label = Path(cwd).name if cwd else directory.name
        print(f"  {label:<28} 세션 {count:>2}개  {cwd or directory}")


def main() -> int:
    parser = argparse.ArgumentParser(description="프로젝트의 대화 기록을 질문·답변 HTML로 묶는다")
    parser.add_argument("project", nargs="?", help="프로젝트 폴더명 (예: peerlens)")
    parser.add_argument("--out", type=Path, help="출력 HTML 경로")
    parser.add_argument("--list", action="store_true", help="변환 가능한 프로젝트 목록")
    args = parser.parse_args()

    if args.list or not args.project:
        print_projects()
        return 0 if args.list else 1

    result = find_project(args.project)
    if isinstance(result, list):
        if not result:
            print(f"'{args.project}' 폴더명과 일치하는 세션이 없다.\n", file=sys.stderr)
            print_projects()
            return 1
        print(f"'{args.project}'에 해당하는 후보가 여러 개다. --out으로 구분하거나 경로를 확인하라:", file=sys.stderr)
        for directory, cwd in result:
            print(f"  {cwd or directory}", file=sys.stderr)
        return 1

    directory, project_path = result
    sessions: list[dict] = []
    for transcript in directory.glob("*.jsonl"):
        pairs, meta = parse_session(transcript)
        if pairs:
            sessions.append({"sid": transcript.stem[:8], "pairs": pairs, "meta": meta})

    if not sessions:
        print(f"'{args.project}'에서 질문·답변을 찾지 못했다.", file=sys.stderr)
        return 1

    sessions.sort(key=lambda s: s["meta"].get("started") or "")

    if args.out:
        out_path = args.out
    else:
        base = Path(project_path) if project_path else Path.cwd()
        out_path = base / "docs" / "logs" / f"{args.project}-qa.html"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(render(args.project, sessions), encoding="utf-8")

    total = sum(len(s["pairs"]) for s in sessions)
    print(f"생성: {out_path}")
    print(f"세션 {len(sessions)}개 · 질문 {total}개")
    return 0


if __name__ == "__main__":
    sys.exit(main())
