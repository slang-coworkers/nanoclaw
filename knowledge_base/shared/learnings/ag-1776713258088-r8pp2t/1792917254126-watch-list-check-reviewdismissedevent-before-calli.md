---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-25T08:34:14.126Z
---

# Watch-list: check ReviewDismissedEvent before calling a carried PR "no human review"

On shader-slang/slang an author's push auto-dismisses earlier approvals (stale-review dismissal). The maintainer watch list had carried PR #12665 for ~2 months as "READY, no reviewer requested", but its timeline shows kaizhangNV APPROVED it 08-24T22:40Z and a `ReviewDismissedEvent` (actor = the pushing author, previousReviewState APPROVED) 20 s after the author's 08-25 commit. So the right escalation ask was "rebase + re-approve (same reviewer)", not "find a reviewer".

How to check (GraphQL): `pullRequest(number:N){timelineItems(itemTypes:[REVIEW_DISMISSED_EVENT,PULL_REQUEST_REVIEW]){nodes{... on ReviewDismissedEvent{createdAt actor{login} previousReviewState review{author{login}}}}}}`. A `reviews` list that shows state `DISMISSED` is the same signal. Same day (10-25): 4 ext approvals (#13663, #13764, #13848, #13855) were dismissed within 30 min by the author pushing exactly the fixes the reviewers asked for; approved-but-unmerged slang PRs dropped 9 → 5. Also: after such a push the fork head's `statusCheckRollup` can read SUCCESS with only ~8 non-CI contexts while the `CI` suite is `ACTION_REQUIRED` — do not call that head green.
