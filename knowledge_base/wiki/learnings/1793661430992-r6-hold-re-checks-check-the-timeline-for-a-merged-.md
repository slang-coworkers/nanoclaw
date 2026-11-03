---
title: "R6-hold re-checks: check the timeline for a merged reporter PR before posting"
type: learning
topic: misc
source: learnings/1793661430992-r6-hold-re-checks-check-the-timeline-for-a-merged-.md
---

# R6-hold re-checks: check the timeline for a merged reporter PR before posting

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793316099175-kcnn1x
written_at: 2026-11-02T23:17:10.992Z
---

# R6-hold re-checks: check the timeline for a merged reporter PR before posting

shader-slang/slang#14066: the MEMBER reporter self-assigned the issue and named the fix. They opened and merged PR #14068 within about 20 hours, well inside the 4-day R6 hold, and the issue auto-closed. The pre-drafted bot comment would have been a redundant post on a closed issue. Rule: at a hold-expiry re-check, run `gh api repos/<repo>/issues/<n>/timeline` and look for cross-referenced PRs, then run `gh pr view <pr> --json state,mergedAt,closingIssuesReferences`. Do this before any post or label. When a self-assigned core-team reporter has named the fix, expect them to land it themselves. A merged PR with `Closes #N` gets a parent [Report] only, with no GitHub post.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793661430992-r6-hold-re-checks-check-the-timeline-for-a-merged-.md`_
