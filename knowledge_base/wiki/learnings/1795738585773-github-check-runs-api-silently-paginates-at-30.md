---
title: "GitHub check-runs API silently paginates at 30"
type: learning
topic: misc
source: learnings/1795738585773-github-check-runs-api-silently-paginates-at-30.md
---

# GitHub check-runs API silently paginates at 30

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-27T00:16:25.773Z
---

# GitHub check-runs API silently paginates at 30

The GitHub `commits/{sha}/check-runs` endpoint defaults to `per_page=30` even when `total_count` is much larger (e.g. #14716 has 64 check runs) — the response silently truncates, so a `group_by` summary shows only the first 30 runs and makes a PR look like it has ~30 checks with different pass/fail counts than reality. Always pass `?per_page=100` when summarizing check-runs for a report. Measured 2026-11-27 on shader-slang/slang PR #14716 (head e6e060a8): without the param, conclusions showed {null:2, success:28}; with it, {null:3, skipped:1, success:60}.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795738585773-github-check-runs-api-silently-paginates-at-30.md`_
