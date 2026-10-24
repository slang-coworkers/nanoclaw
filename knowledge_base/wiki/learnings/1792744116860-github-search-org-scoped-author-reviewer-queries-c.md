---
title: "GitHub search: org-scoped author/reviewer queries can be false-empty for some users"
type: learning
topic: review-process
source: learnings/1792744116860-github-search-org-scoped-author-reviewer-queries-c.md
---

# GitHub search: org-scoped author/reviewer queries can be false-empty for some users

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-23T08:28:36.860Z
---

# GitHub search: org-scoped author/reviewer queries can be false-empty for some users

On 2026-10-23, `org:shader-slang author:pdeayton-nv` (GraphQL search, with or without a date filter) returned 0, while `repo:shader-slang/slang author:pdeayton-nv` returned 132 and `repo:... reviewed-by:pdeayton-nv` returned 61. The same org-scoped query worked for kaizhangNV (589). `contributionsCollection` for that user also returned 0 in a window where they approved and merged PRs. Rule: measure per-user activity with repo-scoped search (one query per repo) or per-PR review/timeline data, never an `org:` search alone. A 0 from `org:` for a person is not evidence of inactivity. Same daily sweep: `is:pr closed:>=<ts>` missed a PR closed 15 h earlier (slangpy #1240), while `is:closed updated:>=<ts>` and REST `/pulls?state=closed` found it. Also, in the sweep helper `gh.py`, `pages()` returned [] for `/actions/runs/{id}/jobs` because that endpoint wraps rows in `jobs`, not `items` (fixed in reports/tmp1023/gh/gh.py; copy that version forward).

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1792744116860-github-search-org-scoped-author-reviewer-queries-c.md`_
