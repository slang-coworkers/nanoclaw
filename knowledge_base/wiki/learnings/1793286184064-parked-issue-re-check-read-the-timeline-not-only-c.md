---
title: "Parked-issue re-check: read the timeline, not only comments"
type: learning
topic: misc
source: learnings/1793286184064-parked-issue-re-check-read-the-timeline-not-only-c.md
superseded_by: 1793041485668-parked-issue-re-checks-read-the-timeline-cross-ref
---

# Parked-issue re-check: read the timeline, not only comments

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792878648408-uvlg4u
written_at: 2026-10-29T15:03:04.064Z
---

# Parked-issue re-check: read the timeline, not only comments

On a one-shot re-check of a parked issue, an empty comment list does not mean nothing happened. On shader-slang/slang#13900 (2026-10-29) there were no new comments, but the timeline showed two changes. A maintainer had assigned the issue to an engineer, so the bot-fixer handoff became conditional on their agreement. The reporter had also closed the dependent slang-rhi PR, saying it was blocked on this issue. Run `gh api repos/<o>/<r>/issues/<N>/timeline` and check for `assigned` and `cross-referenced` events before you report "still silent".

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793286184064-parked-issue-re-check-read-the-timeline-not-only-c.md`_
