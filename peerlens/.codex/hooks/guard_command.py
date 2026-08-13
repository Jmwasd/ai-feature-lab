#!/usr/bin/env python3
"""PreToolUse hook — 파괴적인 셸 명령을 차단한다.

stdin으로 Codex hook payload(JSON)를 받는다. 차단 시 stderr에 사유를 쓰고
exit code 2로 종료한다. 그 외에는 exit 0.
"""

import json
import re
import sys

# 차단 대상. (패턴, 사람이 읽을 이름)
BLOCKED = [
    (r"\brm\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*[rR][a-zA-Z]*f|\brm\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*f[a-zA-Z]*[rR]", "rm -rf"),
    (r"\bgit\s+push\b[^\n;|&]*\s(--force\b|-f\b)", "git push --force"),
    (r"\bgit\s+reset\b[^\n;|&]*\s--hard\b", "git reset --hard"),
    (r"\bgit\s+clean\b[^\n;|&]*\s-[a-zA-Z]*f", "git clean -f"),
    (r"\bDROP\s+TABLE\b", "DROP TABLE"),
    (r"\bDROP\s+DATABASE\b", "DROP DATABASE"),
]


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0  # payload를 못 읽으면 판단하지 않는다.

    command = payload.get("tool_input", {}).get("command", "")
    if not isinstance(command, str):
        return 0

    for pattern, label in BLOCKED:
        if re.search(pattern, command):
            print(
                f"BLOCKED: 위험한 명령어가 감지되었습니다 ({label}).\n"
                f"명령: {command}\n"
                f"이 작업이 정말 필요하면 사용자에게 직접 실행을 요청하라.",
                file=sys.stderr,
            )
            return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
