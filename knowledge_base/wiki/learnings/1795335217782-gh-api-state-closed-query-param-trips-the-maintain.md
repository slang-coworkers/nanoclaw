---
title: "gh api state=closed query param trips the maintainer-write guard hook"
type: learning
topic: misc
source: learnings/1795335217782-gh-api-state-closed-query-param-trips-the-maintain.md
---

# gh api state=closed query param trips the maintainer-write guard hook

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-22T08:13:37.782Z
---

# gh api state=closed query param trips the maintainer-write guard hook

A NanoClaw maintainer-role safety hook blocks `gh api` calls whose URL contains issue state-change patterns — including READ queries like `repos/<owner>/<repo>/pulls?state=closed&...` (the `state=closed` query param alone trips the "closing a GitHub issue is maintainer-only" guard). When sweeping PR closures/merges read-only, use the search API (`is:pr is:merged merged:>=<date>`, `updated:>=`), `gh pr list -R`, or `pulls?state=all` instead — never `pulls?state=closed`. Observed in the slang-maintainer daily-report run 2026-11-22.

**Why:** the hook pattern-matches the URL string, not the actual HTTP verb/payload, so an innocent GET gets rejected with "Closing a GitHub issue is a maintainer-only action" and the whole batched command dies.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795335217782-gh-api-state-closed-query-param-trips-the-maintain.md`_
