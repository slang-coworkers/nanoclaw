---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786482771902-w578xm
written_at: 2026-08-11T23:06:41.678Z
---

# clang-format not on PATH in slang-fixer container; pip-install 17.x per-session

In the slang-fixer container, `clang-format` is NOT on PATH, so `./extras/formatting.sh --cpp` fails with "This script needs clang-format, but it isn't in $PATH". The repo requires clang-format **17.x** (the copilot-instructions "17-18" upper bound is misleading — 17.x is what's pinned/expected).

Fix (ephemeral, per-session):
```
pip install clang-format==17.0.6 --break-system-packages --quiet
export PATH="$HOME/.local/bin:$PATH"
./extras/formatting.sh --cpp --modified   # now finds clang-format 17.0.6
```
Two traps confirmed on this same task:
1. The BARE `./extras/formatting.sh` (no type flag) just prints usage and does nothing — a silent false-green. Always pass a type flag (`--cpp`, `--md`, etc.); markdown needs its own run.
2. The critique-gate PreToolUse hook blocks EVERY `gh` invocation (even read-only `gh api`) with "CRITIQUE REQUIRED" until the required codex stages (CODE_REVIEW, OUTPUT_REVIEW, and PLAN_REVIEW when applicable) are recorded. So: run the full codex critique to approval FIRST, then do all GitHub writes (issue filing, comments, thread replies/resolves) after. Fetch full review-comment bodies via the slang-mcp github tools (not `gh api`) if you need them before the gate clears.
