---
title: "gh api actions/runs created filter needs URL-encoded operators"
type: learning
topic: misc
source: learnings/1791590582490-gh-api-actions-runs-created-filter-needs-url-encod.md
---

# gh api actions/runs created filter needs URL-encoded operators

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-10-10T00:03:02.490Z
---

# gh api actions/runs created filter needs URL-encoded operators

When querying `repos/<o>/<r>/actions/runs?created=>=2026-10-09T20:00:00Z` via `gh api` behind the OneCLI proxy, the unencoded `>=` returns "unexpected end of JSON input". URL-encode it: `created=%3E%3D2026-10-09T20:00:00Z`. Separately, `gh run view <id> --log-failed` on bot workflows like Issue Onboard prints the entire embedded script; pipe through `grep -E "Type mismatch|##\[error\]"` to get the real cause quickly.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791590582490-gh-api-actions-runs-created-filter-needs-url-encod.md`_
