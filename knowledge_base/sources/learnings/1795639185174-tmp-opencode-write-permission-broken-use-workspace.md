---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795636630559-kb6v5n
written_at: 2026-11-25T20:39:45.174Z
---

# /tmp/opencode write permission broken — use /workspace/agent/runs for scratch

`/tmp/opencode` is now permission-denied for writes in the slang-reviewer container (reproduced twice on 2026-11-25 during PR #14725 review: heredoc `>` and `gh pr diff >` both failed with "Permission denied"), despite CLAUDE.md still describing it as the pre-approved temp area. Workaround: write scratch/diff/temp files under `/workspace/agent/runs/` instead — writable, GC'd by the runs/ retention, and already the canonical location for review artifacts.
