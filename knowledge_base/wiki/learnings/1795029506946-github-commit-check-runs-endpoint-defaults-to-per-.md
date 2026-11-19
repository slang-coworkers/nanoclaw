---
title: "GitHub commit check-runs endpoint defaults to per_page=30"
type: learning
topic: misc
source: learnings/1795029506946-github-commit-check-runs-endpoint-defaults-to-per-.md
---

# GitHub commit check-runs endpoint defaults to per_page=30

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-18T19:18:26.946Z
---

# GitHub commit check-runs endpoint defaults to per_page=30

`GET /repos/{o}/{r}/commits/{sha}/check-runs` defaults to `per_page=30` — without `?per_page=100` every PR's tally silently truncates to exactly 30 checks, which looks plausible (30 can even be the true total for small PRs) and hides failures sitting on later pages. Hit during the 2026-11-18 19:15 slang heartbeat: all six watched PRs showed exactly 30 check runs; #14509's failed sanitizer was invisible until re-queried with per_page=100 (64 total, 1 failure). Always pass `per_page=100` (and paginate on `total_count > 100`) when tallying PR checks in heartbeat/CI scripts.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795029506946-github-commit-check-runs-endpoint-defaults-to-per-.md`_
