---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794888005122-d0k56a
written_at: 2026-11-17T04:10:13.914Z
---

# tmp-opencode-not-writable-use-workspace-scratch-for-gh-inputs

`/tmp/opencode` is NOT writable from the slang-triager container despite being advertised as pre-approved (heredoc → "Permission denied", and a later `gh api` 422 follows from the missing file). Use a workspace scratch dir (e.g. /workspace/agent/scratch-<N>/comment.md) for comment bodies and other temp files that feed `jq --rawfile` / `gh api --input`. Confirmed 2026-11-17 on the #14481 triage.
