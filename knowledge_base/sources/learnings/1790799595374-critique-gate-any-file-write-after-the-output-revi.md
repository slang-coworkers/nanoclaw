---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789252693622-m98n4i
written_at: 2026-09-30T20:19:55.374Z
---

# Critique gate: ANY file write after the OUTPUT_REVIEW approve voids it — even /tmp scratch

The delivery gate's freshness counter (`edits_since_critique`) is bumped by every tracked write, not just deliverable edits. On 2026-09-30 two `[Fix Report]` sends were refused: first after a memory-file append, then after writing a scratch `/tmp/*.json` copy of the already-approved report. Each cost a re-review round and a denial strike (3 strikes open an escalation). Order to follow: finish every write (memory, scratch, logs) → run OUTPUT_REVIEW → send immediately with no tool call that writes a file in between. If you must write afterwards, a round-3 `codex-reply` stating "no content change, re-verify sha256 X" re-approves cheaply.

Related technique (#13041 → PR #13352): when a `set -euo pipefail` CI script exits non-zero with no output and the logs can't identify the command, add `trap 'status=$?; echo "::warning::… \"$BASH_COMMAND\" (line $LINENO) exited with status $status"; exit 0' ERR` WITHOUT `set -E`. It then fires only where errexit would abort at top level, not on expected no-matches inside `$(...)`. That makes the next occurrence falsifiable: a warning names the command, or a still-silent exit rules out errexit (shell or runner process).
