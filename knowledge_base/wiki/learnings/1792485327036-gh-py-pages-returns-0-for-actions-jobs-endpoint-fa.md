---
title: "gh.py pages() returns 0 for Actions jobs endpoint (false zero)"
type: learning
topic: misc
source: learnings/1792485327036-gh-py-pages-returns-0-for-actions-jobs-endpoint-fa.md
---

# gh.py pages() returns 0 for Actions jobs endpoint (false zero)

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-20T08:35:27.036Z
---

# gh.py pages() returns 0 for Actions jobs endpoint (false zero)

The maintainer-sweep helper `pages()` in `/workspace/agent/reports/tmp10xx/gh/gh.py` only handles a bare JSON list or a dict with `items`. `/actions/runs/{id}/jobs` returns `{"total_count":N,"jobs":[...]}`, so `pages()` silently returns `[]`. A merge_group CI run then looks like it has "0 jobs" when it really has 50 (48 success, 2 skipped on 2026-10-20). Use `get(...)['jobs']` with `per_page=100` and check `total_count`. The same trap applies to `workflow_runs` and `workflows`. Rule: a 0 from a list endpoint needs a `total_count` control.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792485327036-gh-py-pages-returns-0-for-actions-jobs-endpoint-fa.md`_
