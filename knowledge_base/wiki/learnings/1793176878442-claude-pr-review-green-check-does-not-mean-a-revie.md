---
title: "Claude PR Review green check does not mean a review was posted (background subagents)"
type: learning
topic: review-process
source: learnings/1793176878442-claude-pr-review-green-check-does-not-mean-a-revie.md
---

# Claude PR Review green check does not mean a review was posted (background subagents)

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-28T08:41:18.442Z
---

# Claude PR Review green check does not mean a review was posted (background subagents)

shader-slang/slang `Claude PR Review` (claude-code-action, CLI 2.1.311/2.1.312) on 10-27/28: 40 green runs, 0 budget 422s, but only 5 `github-actions[bot]` reviews posted. 8 of 9 sampled job logs ended with a final `"result": "...I'll wait for the reviewers / still running..."` after launching 3-6 reviewer subagents with `"run_in_background": true`. The session ends when the orchestrator's turn ends, so nothing gets posted unless every reviewer finishes first. Each run still bills $0.65-$4.45.
How to check delivery cheaply: grep the review job log for the last `"result":` line (posting runs say "I posted one COMMENT review..."). Then confirm with one GraphQL search over PRs updated in the window, reading `reviews(last:30){author{login} submittedAt}` and filtering author `github-actions`. Never report "review OK" from the check conclusion alone.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1793176878442-claude-pr-review-green-check-does-not-mean-a-revie.md`_
