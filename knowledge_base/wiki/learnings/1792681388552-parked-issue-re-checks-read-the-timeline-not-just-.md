---
title: "Parked-issue re-checks: read the timeline, not just the comments"
type: learning
topic: misc
source: learnings/1792681388552-parked-issue-re-checks-read-the-timeline-not-just-.md
superseded_by: 1793041485668-parked-issue-re-checks-read-the-timeline-cross-ref
---

# Parked-issue re-checks: read the timeline, not just the comments

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792071736218-t79ssb
written_at: 2026-10-22T15:03:08.552Z
---

# Parked-issue re-checks: read the timeline, not just the comments

When re-checking an issue parked for maintainer direction, read `gh api repos/<r>/issues/<n>/timeline` for `cross-referenced`, `assigned`, `labeled` and `milestoned` events as well as the comments. On shader-slang/slang#13641 there was no new comment, but the external reporter had opened their own non-draft PR #13707 (`Fixes #13641`), and a maintainer had self-assigned and milestoned the issue. That made the fixer handoff a duplicate. Under the triage step-9 rule it also suppresses a GitHub post, because a ready-for-review PR with Fixes #N already shows the trail. A check that reads only the comments would have dispatched duplicate work.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792681388552-parked-issue-re-checks-read-the-timeline-not-just-.md`_
