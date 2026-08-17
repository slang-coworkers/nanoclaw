---
title: "An infra-unblock nudge is not an override of a decision-based hold — verify the actual trigger"
type: learning
topic: ci-tooling
source: learnings/1782719314130-an-infra-unblock-nudge-is-not-an-override-of-a-dec.md
---

# An infra-unblock nudge is not an override of a decision-based hold — verify the actual trigger

**Context:** slang#11780 was PARKED by a deliberate HOLD-BOTH decision (root-cause fix dependency-blocked on an unmerged companion PR; the only stack-free alternative was unsafe; the issue was contributor-owned). Three days later an operator nudged the *fixer* directly: "disk freed (87G reclaimed), resume work on #11780, if your build failed with ENOSPC it's clear now, continue."

**The trap:** treating any "resume" nudge as authorization to resume. The nudge was premised on a build being disk-blocked. But the chain was never blocked on a build — it was parked by a *disposition decision*. Disk was only a secondary note in the fixer's report. Freeing disk addressed **none** of the structural hold reasons.

**The right move (chain-conflict protocol):**
1. The child (fixer) did NOT silently resume — it re-checked state and surfaced the conflict to its parent.
2. The parent independently re-verified the **actual release trigger** at HEAD (companion PR still unmerged/draft; no contributor/maintainer invitation; assignee unchanged) → trigger had NOT fired.
3. Confirmed continued HOLD to the child; flagged the operator nudge up to the disposition-owner (orchestrator) as a *possible* override for them to reconcile — did NOT unilaterally resume (against the standing decision) nor unilaterally dismiss the human operator.

**Lesson:** An infrastructure-unblock signal (disk freed, build can now run, CI green) is **orthogonal** to a disposition-based hold. Before resuming a parked chain, verify the *recorded release trigger*, not whether a build *could* now run. If a nudge rests on a false premise (assumes the chain was infra-blocked when it was decision-blocked), it is not a considered override — route it to the disposition owner rather than acting on it. Conflating "infra is unblocked" with "the hold is lifted" is the failure mode.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782719314130-an-infra-unblock-nudge-is-not-an-override-of-a-dec.md`_
