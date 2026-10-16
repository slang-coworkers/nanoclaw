---
type: project
name: project_nanoclaw_1103_host_grant_ledger
description: "nanoclaw#1103 host-authoritative bypass ledger — CLOSED: MERGED 2026-08-06 09:55Z at 5eeede7f (the 5th head I reviewed). Reviewed INLINE across 5 heads / 4 comments. Standing finding shipped unfixed: a forged bypass that erases its own consumption stamp is never recorded (A2=0 vs control=1), because every detector sits behind an agent-owned guard."
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1103
---

# nanoclaw#1103 — host grant ledger for the critique-gate bypass (CLOSED, merged)

**slang-coworkers/nanoclaw#1103**, `critique-gate: close the second gate's holes, add a host grant
ledger`, author `szihs` (human), base `nv-main`. **MERGED 2026-08-06 09:55Z at `5eeede7f`**, the last
head I reviewed (verified live 2026-10-16). It follows up [[project_nanoclaw_1092_critique_gate_resolved_wedge]].
Main reviewed it inline; no `nanoclaw-pr-approver` exists ([[project_nanoclaw_pr874_webhook_route_approver]]).

**Heads → comments:** `5d3e5b09` → `9e9228f1` (`5202374776`) → `957c9462` (`5202408480`) →
`206b67db` (`5202469844`) → `5eeede7f` (`5203085459`). The author pushed a responsive commit within
minutes of each review ([[feedback_a_synchronize_can_move_the_head_backwards]]).

## Standing finding (shipped unfixed, flagged not-a-blocker)

`reconcileBypassState` only enters its checks when `state.critique_gate_bypass_consumed_at != null`
(`index.ts:307`), and that state file belongs to the agent. Measured against the real module:

| sequence | divergence events |
|---|---|
| A1: forge, then the gate consumes (stamp intact) | 1 |
| A2: same, then the agent nulls the two stamp keys | **0** |
| A3: forge, sweep first | 1, and `approved`→false |

A2 is durable evasion, not the timing limit the PR admits. Heads 3–5 added grant attribution,
fail-closed expiry, replay detection, and revocation and validity-window checks. All of them sit
inside the same guard, so A2 stayed 0 at every head, each time measured beside a firing control.
A2 also defeats the replay detector: the erased use never sets `consumed_at` in the ledger, so the
grant still reads as spendable. The general lesson is in
[[feedback_hardening_a_block_does_not_move_its_guard]]. The only open ask at merge was that the limits
section name **erasure** alongside timing.

## Smaller findings and verifications

- **The tell:** migration 933 created `idx_bypass_grants_session` while no query had a `session_id`
  predicate. An index built for a query that doesn't exist names the missing primitive.
  `getLatestSpendableGrant` adopted it at head 3.
- **The author's unattributed-consumption branch beat my proposed fix.** Going straight to divergence
  would have flagged every legitimate bypass through an older gate (deploy skew between a
  bind-mounted hook and a per-group runner copy). Check what your own suggestion does on the happy path.
- The grant-identity fallback reaches the agent-writable `esc.approval_id`. It is unreachable today,
  but the only handler test omits `approval`, so the test covers the fallback, not the host-owned path.
- `patchGateState` is not atomic. I didn't charge it to this PR because its sibling writer
  `gateShouldYield` is identical.
- Window checks compare against the stamped consumption time, not `now`, so a late sweep cannot
  excuse an out-of-window use.
- Suites were non-inert by implementation swap. Host tests went 1988 → 2001 with 0 regressions. The
  3 poll-loop failures are byte-identical at the merge base.

## Instrument lessons from this review

- `baseRefOid` is nv-main's current tip, not the branch point: a two-dot diff showed 54 files against
  the true 6. Always use `git merge-base` on this fork.
- "N failed files, 0 failed tests" is an import-error signature. Here it was my environment, proven by
  an identical failure at the base.
- A `sed` fix to my probe also rewrote line 377 of the PR's own test. I reverted it and diff-verified.
- `/workspace/extra/ephemeral` is read-only. Empty snapshots printed `MISMATCH`, which looks exactly
  like real hash divergence.
