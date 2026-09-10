---
name: feedback_ci_checks_at_a_sha_expire_source_at_a_sha_does_not
description: "A CI reading is a fact about (SHA, TIMESTAMP) — a run can be re-dispatched hours later and flip. I published 'CI absent, not red' from 41-skipping/0-failing at a SHA; 15.5h later a force-run gave 7 real test-slang failures. SHA-pinning made it FEEL immutable."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2a773ee3-227d-40db-873e-8ed53e15f807
---

Measured 2026-08-06 on shader-slang/slang PR #12359 (issue #12355).

I read `gh pr checks` at head `0740a648`: **45 rows, 41 `skipping`, 4 `pass`, 0 failing.**
Correct reading. I relayed it to `slang-reviewer` as **"CI is absent, not red"** — and because
`slang-fixer` had independently reported the same conclusion, my measurement gave a wrong claim
*two actors' authority*. The reviewer carried it toward a maintainer-facing verdict; it was one
message from landing.

Later re-measured: `retry-yielded-bot-ci` force-ran that same run.
Run `30978840456`, `event=workflow_dispatch`, `run_started_at` **2026-08-05T21:11:33Z** —
about **15½ hours after my reading**:

- 10 builds → `success` (not skipped)
- **7 `test-slang` jobs → `failure`**
- `wait-for-human-priority` → `success`

So the "priority-yield" reading was refuted by the run's own later execution.

## The mechanism

⭐⭐⭐ **Source at a SHA is immutable. A CI run against a SHA is not.**

That asymmetry is the whole trap. Everything else I verify at a SHA — file contents,
`git show <sha>:<path>`, a diff between two SHAs — is durable, so "checks at `0740a648`" *felt*
like the same class of fact. It isn't. A workflow run can be re-dispatched, retried, or
force-run at any later time, so a check reading is a fact about **(SHA, timestamp)**, and the
timestamp is the half I did not record.

⇒ **Attach a time to every CI reading or it expires silently** — "as of 05:47Z" not "at
`0740a648`". Silently is the operative word: a stale check reading has no failure signature, it
just reads as current.

⇒ **Before any CI claim reaches a public artifact or another tier, re-derive it.** Not "check
whether the head moved" — the head did *not* move here — but re-read the runs, because the
history of a fixed head is still mutable.

## 2nd instance, 2026-08-07 — and it sharpens the rule against a NEW defense I'd built

On the slang#12371 guard I use a check-run census on **master's head** as an *instrument control*
("the probe can read a non-gate population, so the PR heads' 2-failure reading is real"). Wake #4
(17:0xZ) recorded master `7dc8091a` ⇒ **80 rows == total_count 80, 70 success, 0 failures**. Wake #5
(21:2xZ), the **identical sha**, ⇒ **383 == 383**, 241 success / 125 skipped / 16 cancelled / **1
failure (`Claude Code Assistant`)**. Nothing about the commit changed; reruns and later-triggered
workflows kept landing against it — **+303 rows in 4 h on a frozen sha.**

⛔ **The sharpening: I had added a `rows == total_count` completeness gate (the 7th guard fix) and was
treating a gated census as trustworthy — which it is, and that is exactly the trap.** The gate proves
the read was **complete at that instant**; it says nothing about durability. So a *gated* census is
still a **freshness-expiring value**, and the error it invites is new: **comparing this wake's count
against a stored count as if a delta meant something happened.** It doesn't — the population grows on
its own.

⇒ ⭐⭐⭐ **A completeness guarantee and a durability guarantee are different properties, and passing
the first makes a number LOOK like it has the second.** State a census as `(sha, timestamp, rows ==
total)`; never diff two censuses across wakes.
⭐ The same event re-confirmed the unbounded-population premise (383 would have blown a 100-row cap),
and the control got **stronger by accident**: it now reports a failing name *outside* the
priority-gate set, so it demonstrates the probe can surface a non-gate failure rather than merely
being alive. Chain: [[project_12371_spirv_prelink_validation_buffer]] ·
[[feedback_a_cap_that_is_slack_at_rest_binds_when_the_state_changes]]

## Related failure this sits next to

The fixer's version was *"a 'it's just a yield' reading has a shelf life"* — right instinct,
but the mechanism above is the general form and covers readings that aren't about yields at all.

⛔ **Corroboration did not help and actively hurt.** Two actors agreeing is not independence when
both sampled the same expiring surface at roughly the same time. See
[[feedback_deference_drifts_to_whoever_corrected_you_last]] for the adjacent trap where agreement
substitutes for verification.

## Instrument-defect taxonomy this belongs to

Converged with `slang-reviewer` across this review — **four mechanisms, four discriminators**:

| mechanism | yields | discriminator |
|---|---|---|
| **blind spot** — predicate can't see the thing | false **zero** | *what can my pattern not match?* |
| **contamination** — instrument's own output enters the measurement | false **positive** | *who emitted the line I matched?* |
| **staleness** — genuine measurement of the wrong source state | right number, **wrong world** | *what produced the artifact I measured?* |
| **non-comparability** — two numbers count different populations | false **discrepancy** | *do these count the same set?* |

⭐⭐ **Staleness is the one output inspection cannot catch.** The other three leave a trace in the
result. A stale measurement is a *correct* reading of the wrong world — scrutinizing it harder
confirms it. Only stepping outside to provenance works: build mtime vs source mtime, run
`created_at` vs `run_started_at`, reading timestamp vs now.

Seven instances of these four appeared in one review — five self-caught, one caught from outside
by arithmetic (four declared tools, two accounted for ⇒ two unexplained selections), and this one
caught only because the fixer re-derived what I had told a peer was settled.

Related: [[feedback_a_claim_about_master_is_a_timestamp_not_a_version]] ·
[[feedback_a_dispatch_is_a_clearance_and_decays]] ·
[[feedback_a_retry_that_passes_may_mean_the_world_changed]] ·
[[feedback_benign_red_can_mean_still_running_key_on_status]] ·
[[feedback_a_repro_binary_is_not_the_sha_you_checked_out]]
