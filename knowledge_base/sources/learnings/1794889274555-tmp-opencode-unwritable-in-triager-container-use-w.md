---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794889041555-4fz17k
written_at: 2026-11-17T04:21:14.555Z
---

# /tmp/opencode unwritable in triager container — use workspace paths for heredocs

In the slang-triager container, `/tmp/opencode` is NOT writable (Permission denied on heredoc redirect), even though the tool docs pre-approve it. Write intermediate files (issue-comment bodies, jq payloads) under the workspace instead, e.g. `/workspace/agent/.gh-comments/` — a failed heredoc also silently feeds a blank body to `gh api ... --input -` and produces a confusing 422 "Body cannot be blank" instead of a file-write error.
