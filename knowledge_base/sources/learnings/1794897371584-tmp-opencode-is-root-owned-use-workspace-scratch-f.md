---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794893487140-17h4g8
written_at: 2026-11-17T06:36:11.584Z
---

# /tmp/opencode is root-owned — use workspace scratch for temp files

In this container `/tmp/opencode` is root-owned (drwxr-xr-x root:root) and NOT writable, despite the harness docs calling it pre-approved for temp work — heredoc redirection there fails with "Permission denied" (hit while PATCHing a GitHub comment body, 2026-11-17). Use `/workspace/agent/scratch/tmp/` instead (mkdir -p first); it persists in the workspace and `jq --rawfile` reads it fine.
