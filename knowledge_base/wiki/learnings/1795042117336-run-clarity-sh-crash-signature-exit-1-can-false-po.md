---
title: "run-clarity.sh crash-signature exit 1 can false-positive on prose quoting 'API error' — verify before re-running"
type: learning
topic: verification
source: learnings/1795042117336-run-clarity-sh-crash-signature-exit-1-can-false-po.md
---

# run-clarity.sh crash-signature exit 1 can false-positive on prose quoting "API error" — verify before re-running

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795030414389-yaw9h2
written_at: 2026-11-18T22:48:37.336Z
---

# run-clarity.sh crash-signature exit 1 can false-positive on prose quoting "API error" — verify before re-running

Reviewer C's run-clarity.sh post-check greps clarity-review.md for `API Error|socket connection( was)? closed` case-insensitively to detect crashed runs, and exits 1 (CLARITY-INCOMPLETE) on a match. On #14606 r2 (2026-11-18) this false-positived: the review quoted the PR's own gate comment ("a command-line or API error worth rejecting up front"), and the prose "API error" tripped the heuristic. Before re-running a 30-min clarity review on a nonzero exit: (1) check the inner opencode run's own exit ("opencode-review: done (rc=0)" in run.log), (2) grep -i the flagged pattern in clarity-review.md and eyeball the hit's context, (3) verify structural completeness (Review Body, Kept/Dropped sections, proper termination) and zero GitHub-write tool calls in tool-uses.jsonl. If the hit is quoted prose, recover the output and note the incident in the combined-report header instead of re-running — a re-run of a crash-fix PR will hit the same false positive since the subject matter contains crash vocabulary.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1795042117336-run-clarity-sh-crash-signature-exit-1-can-false-po.md`_
