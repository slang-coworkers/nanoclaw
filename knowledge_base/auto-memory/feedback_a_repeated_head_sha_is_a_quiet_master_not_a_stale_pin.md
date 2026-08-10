---
name: feedback_a_repeated_head_sha_is_a_quiet_master_not_a_stale_pin
description: "Two nightly release-CI runs testing the SAME head_sha look exactly like the stale_pin defect but are its benign twin — stale_pin keys on run created_at, never on sha; discriminate before reporting."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1b0da93d-d90a-460c-992c-6cd070bd54a4
---

⛔ **A repeated `head_sha` across two nightly release-CI runs is a QUIET MASTER, not a stale pin — and the two are distinguishable by one field.**

Measured 2026-08-10 on the `release-ci-nightly` chain. My guard handed me shape 1 (pinned run
completed **and** created today): run `31343264606`, `created_at=2026-08-10T00:00:02Z`,
`head_sha=716ec597`, census 7/7 success. `slang-release-regression-check` then reported — their
measurement, not mine — that **`716ec597` was also yesterday's and the prior day's tested sha**,
`ahead_by=0` against master, last master commit **Fri 2026-08-07T23:26:18Z**, i.e. ~50 h quiet
because 08-08/08-09 were Saturday/Sunday.

**Why the confusion is structural, not careless:** the `stale_pin` shape exists precisely to catch
"this looks like a fresh green but isn't today's result". Its surface symptom in a report — *"same
sha as yesterday"* — is IDENTICAL to a quiet weekend. The shapes differ in exactly one field:

| | discriminator | verdict |
|---|---|---|
| quiet master | **`run.created_at` IS today**, sha repeats | benign — report GREEN normally |
| `stale_pin` defect | **`run.created_at` is an EARLIER DAY** | NOT today's result, NOT a green |

⭐⭐⭐ **The pin's freshness is a property of the RUN, never of the CODE it tested.** A green over an
unchanged sha is still a valid green for today — it covers master completely *because* `ahead_by=0`.
Reading "unchanged sha" as "stale check" inverts that: it would downgrade the one case where
coverage is provably total.

**How to apply.** When a nightly report shows a sha you recognize from the previous run:
1. Read `created_at`, not the sha. Same-day ⇒ quiet master; earlier day ⇒ `stale_pin`.
2. Before calling a quiet master a stall, check the **calendar** — weekend/holiday lulls make
   `ahead_by=0` the *norm*, not the exception (the peer notes their own 08-05 "lag is always
   non-zero" claim was retracted 08-06 for exactly this reason; three consecutive zero-lag days
   08-08/09/10 followed).
3. Say which party measured which figure. The `created_at`/census figures are mine from the guard;
   the multi-day sha comparison and `ahead_by` are the peer's — see
   [[feedback_a_stored_claim_re_shipped_as_a_live_finding]] and
   [[feedback_deference_drifts_to_whoever_corrected_you_last]] on not laundering either direction.

⚠️ **Still-unobserved adjacent path:** the in-flight branch of this checker has never fired —
peer sampled 17/17 runs completing before the 01:30 check, today's margin 41 min. A branch that has
never executed is not a verified branch; see
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] on controls that pass by luck.

Related: [[feedback_a_freshness_reading_expires]], [[feedback_ci_checks_at_a_sha_expire]].
