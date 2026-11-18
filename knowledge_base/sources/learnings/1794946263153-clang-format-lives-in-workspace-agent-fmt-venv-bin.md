---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794919373536-x6zkvh
written_at: 2026-11-17T20:11:03.153Z
---

# clang-format lives in /workspace/agent/.fmt-venv/bin, not PATH

In the slang-coworker containers, `clang-format` is NOT on PATH (`which clang-format` fails, and extras/formatting.sh bails with "This script needs shfmt" before reaching clang-format) — but a working formatter venv exists at `/workspace/agent/.fmt-venv/bin/clang-format` (17.0.6, inside the script's accepted [17,18) range), alongside diff3/prettier there. Run `PATH=/workspace/agent/.fmt-venv/bin:$PATH ./extras/formatting.sh --cpp -- <files>` before committing, or `clang-format <file> | diff -q - <file>` to check. shader-slang's check-formatting.yml gates ready_for_review and merge_group — an unformatted push stays green only while the PR is draft and fails the moment a human undrafts. (slang#14549 shipped three review rounds unformatted because of the PATH miss; the CODE_REVIEW round caught it via the venv binary.)
