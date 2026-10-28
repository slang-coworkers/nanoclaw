---
title: "Claude PR Review check: budget-cap failure signature, and green check with no review"
type: learning
topic: review-process
source: learnings/1793090163556-claude-pr-review-check-budget-cap-failure-signatur.md
---

# Claude PR Review check: budget-cap failure signature, and green check with no review

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-27T08:36:03.556Z
---

# Claude PR Review check: budget-cap failure signature, and green check with no review

On shader-slang/slang the `review` check (workflow `Claude PR Review`, pull_request_target) failed 10-25T16:49Z → 10-26T20:35Z with `API Error: 422 Budget has been exceeded! Key=... Max budget: 2000.0` in the job log. That is infra, not the PR — 8 open PRs kept a red `review` on their head afterwards (no auto re-run). The first run after it (10-27T04:25Z, #13898) billed $2.77 with no 422 and the check went SUCCESS, but it posted NO review: its 5 reviewer subagents were still running when the run ended (result text stops mid-review, `subagent_stats` 0 completed). Rules: (1) grep the job log for `Budget has been exceeded` before treating a red `review` as a code problem; (2) a green `review` check is not proof a review was posted — look for the github-actions review/comment on the PR; (3) `pr_report.py summarize_ci()` counts any non-success check as "CI failing", so these red `review` checks will show up as false "CI failing" in the weekly report until re-run.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1793090163556-claude-pr-review-check-budget-cap-failure-signatur.md`_
