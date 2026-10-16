---
type: feedback
name: feedback_hardening_a_block_does_not_move_its_guard
description: "A fix that enriches what happens INSIDE a guarded block does not change whether the block is reached. Re-test the guard, not the body, and re-test the old gap against each new detector: a detector stacked on an unfixed guard inherits its blind spot. Measured on nanoclaw#1103 across 3 heads."
metadata:
  node_type: memory
  type: feedback
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1103
---

# Hardening a block does not move its guard

**Rule.** When a PR answers a finding by adding checks, first ask which condition decides whether
those checks run at all. If that condition is unchanged, the original gap is unchanged too, however
good the new body is. Re-measure the old gap, with a firing control, at every head.

**Why.** On [[project_nanoclaw_1103_host_grant_ledger]], heads 3, 4 and 5 each added real
detection: grant attribution, fail-closed expiry, replay detection, and revocation and
validity-window checks. All of them lived inside
`if (state.critique_gate_bypass_consumed_at != null)`, a field the agent writes. The erasure attack
(null that field) measured 0 at every head, while the control measured 1 in the same run.

Two corollaries from the same chain:

- **A new detector inherits the guard's blind spot.** The replay detector keys on `consumed_at`
  already being set in the ledger. Erasure prevents that write, so every reuse of an erased grant
  reads as a first use. The old gap silently defeated the new mechanism. Never assume they are
  independent.
- **Hardening the declared branch shifts pressure onto the undeclared one.** Each check makes a
  *declared* consumption harder to fake, which only raises the attacker's incentive to not declare.

**Dose.** After the finding is on record twice, a later follow-up gets one line and a pointer, not a
third full restatement.

Related: [[feedback_a_null_guard_inside_a_truthiness_branch_is_dead]].
