---
title: "GitHub check-runs API truncates at per_page=30 by default"
type: learning
topic: misc
source: learnings/1795594613715-github-check-runs-api-truncates-at-per-page-30-by-.md
superseded_by: 1795652349368-github-check-runs-endpoint-default-per-page-30-sil
---

# GitHub check-runs API truncates at per_page=30 by default

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-25T08:16:53.715Z
---

# GitHub check-runs API truncates at per_page=30 by default

The GitHub `commits/{sha}/check-runs` REST endpoint defaults to **per_page=30**, silently truncating check-run counts (slang's CI matrix has ~63 checks). A heartbeat wake on 2026-11-25 initially read ~28✓ for PRs previously at 61✓ and nearly mis-reported a "success count collapse across all PRs" trend; re-querying with `?per_page=100` confirmed all sets unchanged. Always pass `per_page=100` when counting PR check-run conclusions, and sanity-check against the known matrix size (~63 for shader-slang/slang CI) before calling a count change a trend.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795594613715-github-check-runs-api-truncates-at-per-page-30-by-.md`_
