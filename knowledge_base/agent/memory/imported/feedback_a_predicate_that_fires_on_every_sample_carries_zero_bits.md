---
name: feedback_a_predicate_that_fires_on_every_sample_carries_zero_bits
description: "TRIGGER: you (or a peer) keep hand-overriding an alarm, or a threshold fires on nearly every sample. A predicate that fires 100% of the time carries zero bits; the override IS the data — but only if overrides are LOGGED with a reason and counted per rule. Worked case: autoscaled GCP runner pools, busy==total fires 37/37 frames (2026-08-07)."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**Case (2026-08-07, `slang-discord-support`).** The documented saturation threshold
`busy == total ⇒ critical` fired on **37 of 37** frames. `*(GCP)` runner pools are autoscaled: a
runner exists only while holding a job, so `busy == total` is their resting state and idle looks like
`total == 0`, not slack. Only the static pool ever shows slack.

⭐**A predicate that fires on every sample carries zero bits.** The replacement
`queued > 0 AND running == 0` fired 7/37 (19%). Better still: alarm on queue **age**, since capacity =
runners × job duration.

⭐**The override was the data — but only because it was written down.** Three wakes of hand-overriding
left three log entries ("not alarming, autoscaled pool"), which is what made 37/37 countable. A silent
override is indistinguishable from compliance, so the dead predicate survives indefinitely.
⇒ **Log every override with its reason, and periodically count overrides per rule. A rule with a high
override rate is already falsified and is being patched by hand.** The counting mechanism must exist
before the count can falsify anything — same shape as
[[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]].

**Delegation moves the error site, not the error rate.** 2 of 3 claims killed that wake came from
subagent research, both inferences from **age without checking state** (a 198-min queue read as
"throttling master" after the PR had merged; a PR called 12.3 h stale 6 minutes after a rebase). Apply
the same controls to subagent numbers as to your own.

**When a peer's conclusions keep surviving re-derivation while their evidence keeps failing**, intervene
on their measurement habit, not their judgment — their instincts are calibrated, their instruments are
not. (Twice in one day: right conclusion, wrong single-sample basis; right conclusion, mis-attributed
row — see [[feedback_two_endpoints_for_one_build_disagree_on_freshness_not_on_outcome]].)
