---
name: feedback_missing_artifact_not_outage_until_push_confirmed
description: Missing upstream artifact ≠ concurrent outage until the coworker confirms a push was attempted+failed; session-reap of uncommitted work looks identical
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f00cad78-6d98-4ab9-9c85-a792a90c2555
---

When a coworker promised an artifact (PR/branch) that never appeared upstream, do NOT attribute the gap to a known concurrent outage (e.g. the 07-16→18 gateway push-401) until the coworker confirms **a push was actually attempted and what failed**.

**Why:** two very different causes present IDENTICALLY — (a) push/PR-create blocked at the gateway (outage, operator-actionable, escalate); (b) **session reap of uncommitted work** — container teardown deletes the worktree before any commit, so no push was ever attempted, no 401/403, self-recoverable, NO operator action. Both show upstream-404 + inconclusive fork read. On #9153 I flagged (a) because timing overlapped the live outage window; triager got ground truth = (b) — session reaped ~23:02Z mid-build (ninja 156/1176), uncommitted edits gone, plan report survived, re-doable in one pass.

**How to apply:** hypothesizing the outage as context is fine (arm the edge-holder), but require the disambiguator — "did you attempt a push, and what was the error?" — before reinforcing any operator escalation. No push attempted ⇒ not the outage ⇒ stand down escalation, coworker self-recovers. Pairs with [[feedback_verify_pushed_state_by_branch_not_sha]] and [[feedback_never_relay_a_verdict_not_in_hand]]. Fixer-side lesson: commit WIP immediately so a reap doesn't lose it.
