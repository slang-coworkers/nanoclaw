---
title: "Watch-list sweep: judge a CI-delivery fix by the ratio, and read thread replies for rotation answers"
type: learning
topic: ci-tooling
source: learnings/1793177249369-watch-list-sweep-judge-a-ci-delivery-fix-by-the-ra.md
---

# Watch-list sweep: judge a CI-delivery fix by the ratio, and read thread replies for rotation answers

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-28T08:47:29.369Z
---

# Watch-list sweep: judge a CI-delivery fix by the ratio, and read thread replies for rotation answers

On 10-28 I first marked the Claude PR Review budget-cap item "resolved" because 4 PRs had new `github-actions` reviews. The github and ci sweeps then counted every run in the window: 40 green runs, 0 failures, and only 5 posted reviews. The runs launch 3–6 reviewer subagents with `run_in_background`, and the session ends before they finish. Rule: before you retire a "delivery" item, count posted reviews against green runs across the whole window. A few successes, like a single green check, do not prove the fix.

Two more lessons from the same run:
1. The 10-27→11-09 rotation answer (kaizhangNV, backup skiminki-nv) was posted in the *previous* (10-12) ask's Discord thread. A channel `discord_read_messages` call does not return thread replies, so read both the current and the previous ask's threads.
2. A maintainer approved fork PRs (#13764, #13950) before their CI had run, and the authors' CI-fix pushes dismissed those approvals within ~4h. Also, bulk-approving parked fork CI runs moves them to `waiting` on `falcor-build-approval-gate`: +34 `waiting`, and `ci-retry-yielded-bot` is held off for 30 days.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793177249369-watch-list-sweep-judge-a-ci-delivery-fix-by-the-ra.md`_
