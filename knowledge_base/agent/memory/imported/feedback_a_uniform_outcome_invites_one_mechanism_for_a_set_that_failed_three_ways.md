---
okf_version: "0.1"
name: feedback_a_uniform_outcome_invites_one_mechanism_for_a_set_that_failed_three_ways
description: "I wrote 'all five heads: NONE (the priority gate skipped them)' — the NONE was right, the cause was wrong in three different ways (draft filter skipped / gate failed / no CI created at all). A uniform outcome makes one explanation feel measured; each member needs its own cause evidence."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dfd5edcd-1812-4453-bab7-d14fc9d92e11
---

⛔ **A uniform OUTCOME across a set invites a single MECHANISM to explain it, and the explanation
inherits the outcome's credibility without ever being measured.**

Measured 2026-08-09 14:1xZ on slang#12371. I published, to a peer and to the operator: *"a
`test-windows-*-gpu / test-slang` check-run has never existed at any of the five heads carrying the
skip — `50d7a5e7`, `7037262b`, `115185a0`, `97cf9c6d`, `80c93009` all return **NONE** (**the priority
gate skipped them at every one**)."* The NONE was correct and load-bearing. **The parenthetical was
false for three of the five, in three different ways** — and I only tested it because the peer's own
finding (an umbrella check-run masking an absent sub-check) forced me to look at *how* the absence was
produced:

| head | mechanism | evidence |
|---|---|---|
| `50d7a5e7`, `7037262b` | **draft `filter` guard** — only a `pull_request` run exists and its `filter` job is itself `skipped`, so the priority gate never evaluated | `filter=skipped`, `wait-for-human-priority=skipped` |
| `115185a0`, `80c93009` | **the priority gate** — the case I described | `filter=success`, gate=`failure` |
| `97cf9c6d` | **no CI ever created** | `total_count=0` check-runs, **0** check-suites, **0** workflow runs |

⭐⭐⭐ **The tell I should have caught: my sentence explained a 5-member set with one cause while the
set's own totals were visibly heterogeneous** — `total=48 / 48 / 84 / 0 / 84`. A `total_count=0` head
cannot have been "skipped by the gate"; there was no run to skip it. **The differing denominators were
on my screen in the same table as the NONEs.**

⚠️ **Why it survived my own discipline:** I had just verified the *outcome* five times with a
completeness-gated census, so the sentence felt measured end-to-end. **Verification effort spent on the
claim's first half launders its second half.** This is the neighbouring-true-figures effect
([[feedback_an_elapsed_time_figure_drifts_because_nothing_recomputes_it]]) one level up: not a false
number beside true ones, but a false *cause* welded to a true *effect* — see
[[feedback_a_fused_claim_welds_a_true_fact_to_an_invented_one]].

✅ **Checks that fire at the moment of writing:**
- **A parenthetical cause is a claim.** If a sentence reads `<measured outcome> (<because X>)`, the
  parenthetical needs its own per-member probe or it must be dropped. Cheap rewrite that is always
  true: *"absent at all five; cause not established per head."*
- **Heterogeneous denominators refute a homogeneous cause for free** — scan the totals column before
  writing the explanation. Differing `total_count` across members means at least two mechanisms.
- **"Cause unidentified, effect measured" is a publishable position** and my store already records it
  as the right terminal shape ([[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]]).
  Reaching for the plausible single cause is what turns a sound finding into a correction.
- ⭐⭐ **A peer's finding about their instrument is a prompt to re-audit my CONCLUSIONS built on the same
  instrument**, not just to check whether their number matches mine. Their umbrella-vs-subcheck note
  said nothing about causes; following it into *how* the absence arose is what surfaced this.

Kin: [[feedback_mechanism_must_predict_observed_coordinates]] (a mechanism must explain *where*, not
merely that it could) — here it failed to explain *which members*.
