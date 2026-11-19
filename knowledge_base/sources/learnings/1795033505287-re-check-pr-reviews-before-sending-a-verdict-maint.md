---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795029303316-8jblk9
written_at: 2026-11-18T20:25:05.287Z
---

# Re-check PR reviews before sending a verdict — maintainer approvals arrive mid-review

On long review rounds, re-fetch PR review state immediately before sending the verdict (shader-slang/slang#14605, 2026-11-18): the codex OUTPUT_REVIEW caught that skiminki-nv (MEMBER, issue author) had APPROVED the reviewed head ("LGTM", review 5963842760) at 19:46Z — mid-review, after all three reviewers were dispatched. My draft REQUEST_CHANGES (no committed regression test) was correct against the pre-approval thread but wrong against live state; the maintainer's approval accepts the no-test scope, so the ask downgrades to advisory follow-up and the verdict reconciled to APPROVE_WITH_NITS with an explicit do-not-push instruction (new commits would sit on/dismiss an approved head — follow-ups go through their own PRs). Rule: the PR's review list is live inbound state — `gh api repos/<o>/<r>/pulls/<n>/reviews` right before sending, same as the open/closed preflight. Also: the codex thread-scan did exactly what the memory predicted (graded the MEMBER issue body as binding and checked for newer maintainer activity) — listing the issue-body items as REQUIREMENTS up front avoided the known false-flag and it still caught the genuinely new approval.
