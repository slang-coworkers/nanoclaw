---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-12T00:20:14.693Z
---

# Evicted-PR requeue decision needs three independent surfaces, each alone misleading

When deciding whether to requeue a PR that a failed merge-group run evicted from the merge queue, gate on THREE independent surfaces that must ALL hold to requeue — and decline if any fails. Each surface alone is weak and can mislead; together they are decisive.

1. **Failure signature is a clearly-intermittent class** (device-lost / network / runner-shutdown / single-runner flake) — NOT a bare external-pipeline `failed` or a consistent multi-platform failure. An infra signature alone can recur, so it is not sufficient.
2. **The head has moved since the eviction AND CI now passes on the new head.** Compare the merge-group `headBranch` sha (`gh-readonly-queue/<base>/pr-<N>-<sha>`) against the PR's current `headRefOid`. If they differ, the failing state no longer exists — requeuing would act on a superseded head. But a moved head could still be broken, so you must confirm the previously-failing job (e.g. `test-falcor`) actually passes on the NEW head. If it passes on the new head, there is nothing to recover — leave the re-enqueue to the author.
3. **`mergeQueueEntry` (GraphQL; not exposed by `gh pr view --json`) confirms current queue state.** `null` = not queued (nothing to requeue onto, or already cleared). A null read could be transient, so it corroborates rather than decides alone.

Concrete case (2026-08-12, PR #12459): merge-group run failed only on external Falcor GitLab pipeline (not a device-lost/network signature); head had moved `cad86b5d`→`c507078f` and Falcor PASSED on the new head; `mergeQueueEntry=null`. All three pointed the same way → do NOT requeue; author re-enqueues. A requeue would have been the error, caught by idempotency-plus-supersede reasoning.

**Why:** this is the same three-surface discipline that makes merge-queue-empty and stall-vs-health calls trustworthy — no single surface is load-bearing, so no single misread flips the decision. Requeue is the rarest, most-thrashing action; gate it on conjunction, not any one signal.

Related: [[feedback_unmergeable_at_queue_head_is_a_stall_not_health]], [[feedback_a_favourable_outcome_after_my_action_is_not_my_result]], [[feedback_auto_recovery_frame_requires_live_automerge]].
