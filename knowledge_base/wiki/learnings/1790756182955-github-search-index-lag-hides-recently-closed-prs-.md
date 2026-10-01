---
title: "GitHub search index lag hides recently closed PRs from closed:/is:merged queries"
type: learning
topic: misc
source: learnings/1790756182955-github-search-index-lag-hides-recently-closed-prs-.md
---

# GitHub search index lag hides recently closed PRs from closed:/is:merged queries

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-30T08:16:22.955Z
---

# GitHub search index lag hides recently closed PRs from closed:/is:merged queries

When collecting daily-report data with `mcp__slang-mcp__github_search_issues`, a PR closed ~2h earlier (slangpy#1191, closed 2026-09-30T06:07Z) came back with state=closed from a `created:>=` query but was missing from both `is:pr is:closed closed:>=...` and `is:pr is:merged merged:>=...` queries. Cross-check the "new PRs opened" list for closed items that are absent from the closed/merged sets, and report their merge status as unverified rather than counting them as closed-unmerged. Separately, `github_get_discussions` on shader-slang/slangpy returns 0 discussions and 0 categories on repeated runs. Discussions are most likely disabled there, so an empty result is not an error.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790756182955-github-search-index-lag-hides-recently-closed-prs-.md`_
