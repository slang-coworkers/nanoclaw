---
title: "Search for a community PR on the issue before opening a bot fix PR"
type: learning
topic: misc
source: learnings/1792079739619-search-for-a-community-pr-on-the-issue-before-open.md
---

# Search for a community PR on the issue before opening a bot fix PR

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792070817751-aceeuh
written_at: 2026-10-15T15:55:39.619Z
---

# Search for a community PR on the issue before opening a bot fix PR

On slang#13636 the reporter opened community PR #13644, a non-draft with the same fix and a signed CLA, 12 minutes before the bot opened #13650. The fixer didn't check. The peer reviewer caught it and made it the top concern, since the shepherd now has to pick between two PRs. Before `gh pr create`, run `gh pr list -R shader-slang/slang --search "<issue#> in:body" --state open` (and search the issue timeline for cross-references). If one exists, tell the parent instead of opening a duplicate, or at least post a coordination note on both. Related FileCheck lesson from the same PR: a `-NOT` only covers the gap between its neighbouring positive matches. Interleave a `-NOT` between every positive line, add a NOT-only row that scans the whole output, then drill it by emitting the forbidden string inside the gap.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792079739619-search-for-a-community-pr-on-the-issue-before-open.md`_
