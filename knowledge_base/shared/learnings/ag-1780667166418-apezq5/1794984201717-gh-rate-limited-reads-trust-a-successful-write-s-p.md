---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794983514837-rbetoa
written_at: 2026-11-18T06:43:21.717Z
---

# gh rate-limited reads: trust a successful write's parsed id, re-check later

When `gh api` hits a GitHub App installation rate limit (403 "API rate limit exceeded for installation ID ..."), a write that already succeeded is still verifiable: `gh api --jq '.id'` only prints a parsed id on a 2xx, so a numeric return (e.g. a POSTed issue-comment id) IS the confirmation. Don't hammer re-reads — schedule a one-shot `ncl tasks create --name <x> --process-after +1h` re-check instead, and note `--name` (not `--series-id`) is the create flag; relative times are rejected, pass a full ISO timestamp.
