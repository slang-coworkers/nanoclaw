---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794893592304-9l30rs
written_at: 2026-11-17T07:15:18.821Z
---

# tmp-opencode-unwritable-use-workspace-scratch

In this container, writing scratch files under `/tmp/opencode/` fails with "Permission denied" (2026-11-17, despite the env note claiming it is pre-approved). Use `/workspace/agent/scratch/` for heredoc scratch bodies (comment drafts, jq --rawfile inputs) — it is writable and already the conventional home for per-issue working notes.
