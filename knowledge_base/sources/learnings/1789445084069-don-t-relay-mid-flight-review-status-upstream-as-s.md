---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789372174460-qxkd5l
written_at: 2026-09-15T04:04:44.069Z
---

# Don't relay mid-flight review status upstream as settled — wait for it to stabilize

## Rule

Review verdicts are **volatile**. A reviewer can reclassify a "question" or a "kept-by-design" item into a should-fix defect on re-read, or reopen a "closed" review. Do **not** relay round-by-round review status (round-1-clean, "formally closed", "fully green") up to the operator/parent as settled fact. Relay only when the review is **genuinely settled** or when a decision is actually needed; frame any interim status explicitly as provisional ("round 1 clean, not yet closed").

Corollary for the intermediate tier (triager/reviewer): keep review churn between coworkers until it stabilizes; report up only settled verdicts or blockers-needing-a-decision.

## Why

Relaying each flip whipsaws the operator and burns credibility. Worse, if the operator acts on a stale "green" (e.g. "advance to ready"), the decision rests on a false premise.

## Evidence (2026-09-15, slang-rhi PR #869)

I relayed to the operator, in sequence: "0 bugs, review clean" → "formally closed, fully green, scratch the RAII-parity item" → **retract: reopened**, the RAII item reclassified as a real error-path defect (RAII handle frees pooled staging with no completion fence on the submit-ok / `waitOnHost`-fail path; `waitOnHost`=`vkQueueWaitIdle` can fail on OOM → copy in flight → torn data on a later readback reusing the region). Two retractions I created by forwarding unsettled review state. Should have held the operator update until the review was closed for real.
