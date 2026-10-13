"""Simple-Technical-English check behind gate-ste-writing.sh (run as `python3 ste_gate.py`).

Text that other people read (a PR description, an issue, an issue comment) follows
the `slang-ste-writing` skill: short sentences, one topic per paragraph, no
unapproved words. The skill ships the checker, `scripts/ste_check.py`; this gate
only finds it and runs it on every body the Bash command sets, reusing
pr_description.py to read inline, heredoc, `$(cat FILE)` and `--body-file` text.

Reads the PreToolUse hook JSON on stdin. Exit 0 = allow (no checker installed in
this group, nothing to check, or no findings). Exit 2 = deny, with one line on
stderr listing up to three findings and the skill to apply. STE_WRITING_GATE=0
disables; STE_CHECK=<path> points at a checker outside the default locations.
"""

from __future__ import annotations

import importlib.util
import json
import os
import shlex
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pr_description import Reader, Unreadable, bodies

CHECKER_CANDIDATES = (
    os.environ.get("STE_CHECK", ""),
    os.path.expanduser("~/.claude/skills/slang-ste-writing/scripts/ste_check.py"),
    "/home/node/.claude/skills/slang-ste-writing/scripts/ste_check.py",
    "/app/skills/slang-ste-writing/scripts/ste_check.py",
)
MAX_SHOWN = 3


def load_checker():
    """Return the installed skill's `check_text`, or None when the skill is not in this group."""
    for path in CHECKER_CANDIDATES:
        if path and os.path.isfile(path):
            spec = importlib.util.spec_from_file_location("ste_check", path)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)  # type: ignore[union-attr]
            return getattr(mod, "check_text", None)
    return None


def main() -> int:
    if os.environ.get("STE_WRITING_GATE", "1") == "0":
        return 0
    try:
        hook = json.load(sys.stdin)
    except ValueError:
        return 0
    if hook.get("tool_name") != "Bash":
        return 0
    cmd = (hook.get("tool_input") or {}).get("command") or ""
    if isinstance(cmd, list):
        cmd = cmd[2] if len(cmd) >= 3 and cmd[1] in ("-c", "-lc") else shlex.join(str(c) for c in cmd)
    check_text = load_checker()
    if check_text is None:
        return 0
    try:
        found = bodies(Reader(str(cmd), str(hook.get("cwd") or "")), kinds=("pr", "issue"))
    except (Unreadable, ValueError):
        # The description gate already refuses unreadable PR text; issue text we cannot read is let through.
        return 0
    for what, body in found:
        findings = check_text(body)
        if findings:
            shown = "; ".join(f"line {n}: {msg}" for n, msg in findings[:MAX_SHOWN])
            more = f" (+{len(findings) - MAX_SHOWN} more)" if len(findings) > MAX_SHOWN else ""
            print(
                f"WRITING CHECK for {what}: {shown}{more} — rewrite per the slang-ste-writing skill "
                "(short sentences, one topic per paragraph, approved words), then retry.",
                file=sys.stderr,
            )
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
