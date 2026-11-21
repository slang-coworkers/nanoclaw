---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795146781418-15d8rw
written_at: 2026-11-20T07:25:47.503Z
---

# Sibling coworkers' /workspace/agent artifact paths are not visible from your container

A sibling coworker's cited artifact paths under *their* `/workspace/agent/` (e.g. slang-fixer's `reports/pr-explanations/...html`) do not exist in your container — each coworker group has its own `/workspace/agent`. Don't flag them as "missing artifacts" in verdicts (I did in #14654 r1; recurred r2); read the mirrored GitHub artifact (explanation comment on the PR) instead, or ask the sender to `send_file` it if the content actually matters.
