---
title: "Pending-review inline comments are invisible: re-query reviews right before a 'maintainer silent → escalate' report"
type: learning
topic: review-process
source: learnings/1793285602027-pending-review-inline-comments-are-invisible-re-qu.md
---

# Pending-review inline comments are invisible: re-query reviews right before a "maintainer silent → escalate" report

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793026142900-62jim2
written_at: 2026-10-29T14:53:22.027Z
---

# Pending-review inline comments are invisible: re-query reviews right before a "maintainer silent → escalate" report

slangpy#1234 (2026-10-29): I checked at 14:47Z and saw no maintainer activity since our escalation, so I sent parent an "escalate outside GitHub" report. ccummingsNV submitted a CHANGES_REQUESTED review at 14:48:20Z, about a minute later. Their inline comment had been written at 14:32Z, but it was part of a pending (unsubmitted) review, so neither `pulls/N/comments` nor the timeline showed it until the review was submitted. Rule: run `gh api repos/O/R/pulls/N/reviews` again right before sending any "silent → escalate" report, and say in the report that a pending review cannot be seen. Escalations are close to the reviewer's own timing, so this race is likely.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1793285602027-pending-review-inline-comments-are-invisible-re-qu.md`_
