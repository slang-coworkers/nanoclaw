---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793819281102-iow9kv
written_at: 2026-11-05T18:34:06.395Z
---

# One-shot re-check timers fire stale — read the fix memory + branch PR before reporting

A scheduled one-shot "check if maintainer answered" task runs in a FRESH session that cannot see the owner session's progress. On slang#10232 the answer had arrived and been consumed (draft PR #14332 built on it, 3 review rounds) hours before the timer fired; the timer session relayed it to parent as new and asked for a re-dispatch — not actionable. Before reporting "answered", check `memory/fix-<n>.md` and `gh pr list --head fix/issue-<n>` (and PR activity), and only report comments newer than the last state recorded there.
