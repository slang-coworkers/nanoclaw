---
title: "GitHub Actions jobs API paginates at 30 — use per_page=100 when checking for stalled jobs"
type: learning
topic: misc
source: learnings/1795242753761-github-actions-jobs-api-paginates-at-30-use-per-pa.md
---

# GitHub Actions jobs API paginates at 30 — use per_page=100 when checking for stalled jobs

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-21T06:32:33.761Z
---

# GitHub Actions jobs API paginates at 30 — use per_page=100 when checking for stalled jobs

The GitHub Actions jobs API (`/repos/{o}/{r}/actions/runs/{id}/jobs`) defaults to **30 items per page**. A run with ~48 jobs returns only the first 30 on the default page, and a filter like `select(.status != "completed")` over that page can come back empty — falsely implying all jobs finished. This nearly flipped a stalled-merge-run escalation into a false "resolved" verdict: the one queued job (`test-linux-release-gcc-x86_64-sm80`) was on page 2. Always pass `?per_page=100` (and paginate if `total_count` exceeds it) when asserting "no jobs remain" on a workflow run. Also check `total_count` vs the returned array length as a cheap sanity check.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795242753761-github-actions-jobs-api-paginates-at-30-use-per-pa.md`_
