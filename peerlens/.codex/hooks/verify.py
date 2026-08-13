#!/usr/bin/env python3
"""Stop hook — 턴이 끝날 때 린트·빌드·테스트를 실행한다.

현재 존재하는 것만 실행한다. package.json이 아직 없는 단계에서는 파이썬
테스트만 돈다.

실패하면 stderr에 결과를 쓰고 exit 2로 종료한다. Stop 이벤트에서 exit 2는
턴을 거부하는 것이 아니라 stderr 내용을 새 continuation 프롬프트로 삼아
에이전트를 계속 돌린다. 그 프롬프트는 기본 2500토큰 제한을 쓰므로 출력을
짧게 유지한다. stop_hook_active가 참이면 이미 한 번 이어서 작업한 것이므로
무한 루프를 막기 위해 통과시킨다.
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _run(label: str, cmd: list[str]) -> tuple[bool, str]:
    proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if proc.returncode == 0:
        return True, ""
    tail = (proc.stdout + proc.stderr).strip()[-1500:]
    return False, f"## {label} 실패 (exit {proc.returncode})\n{tail}"


def _checks() -> list[tuple[str, list[str]]]:
    checks: list[tuple[str, list[str]]] = []
    if (ROOT / "package.json").exists():
        checks += [
            ("lint", ["npm", "run", "lint"]),
            ("build", ["npm", "run", "build"]),
            ("test", ["npm", "run", "test"]),
        ]
    if (ROOT / "scripts" / "test_execute.py").exists():
        checks.append(
            ("harness pytest", ["python3", "-m", "pytest", "scripts/test_execute.py", "-q"])
        )
    return checks


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        payload = {}

    if payload.get("stop_hook_active"):
        return 0  # 이미 이 hook 때문에 이어서 작업 중이다. 다시 막지 않는다.

    failures = [msg for ok, msg in (_run(l, c) for l, c in _checks()) if not ok]
    if failures:
        print("검증이 실패했습니다. 수정한 뒤 마무리하라.\n\n" + "\n\n".join(failures), file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
