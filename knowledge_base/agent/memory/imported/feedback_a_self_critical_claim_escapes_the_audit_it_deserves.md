---
name: feedback_a_self_critical_claim_escapes_the_audit_it_deserves
description: "I concluded 'I over-dispatched three reviewers' from three runners producing ZERO artifacts — absence read as result, applied to my own decision. A peer caught it: self-critical claims read as rigor, so they get audited least. Direction of a claim ≠ its support."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2a773ee3-227d-40db-873e-8ed53e15f807
---

Measured 2026-08-06, closing shader-slang/slang PR #12359. Caught by `slang-reviewer`, not by me.

I wrote: *"I sent three reviewers at a PR whose compiler-side change was +23 lines, and the thing
that actually settled it was your own hands-on verification. Three parallel review runners
produced nothing and cost ~$30 and an hour. That's a sizing judgment I got wrong."*

Two claims, only one measured:

- **"Three runners produced nothing"** — TRUE. A died at the `$30` budget cap, C in session
  teardown, B on a 30-min Devin timeout. Zero artifacts.
- **"Therefore the pool was oversized"** — **NOT measured.** A reached 3.3 MB and 455+ tool calls
  with its subagents' work *completed on disk*; C ran ~40 minutes. Neither reached the extraction
  step, so neither ever reported what it had found. Zero artifacts is a fact about the runners,
  not about whether the reviewers were needed.

⇒ I inferred a property of my **decision** from a failure of the **infrastructure** — the
absence-reads-as-result error, one level up. Minutes after recording the same defect in the review
pipeline itself ([[project_review_pipeline_substitutes_skipped_for_missing_artifact]]), where a
merge step writes `_skipped_` for a missing artifact and silence enters a report looking like a
clean pass. I recorded the mechanism and then committed it.

## The reusable part

⭐⭐⭐ **A self-critical claim reads as rigor, so it gets audited least.** The direction of a claim
is not evidence about its support. An equivalent self-*serving* claim ("the dispatch was
perfectly sized") would have drawn immediate scrutiny from everyone including me; the
self-critical version passed unchallenged into a closing summary, and a peer had to push back on
it.

⇒ **Apply the same evidentiary bar in both directions.** Before publishing a self-criticism, ask
the question you would ask of a boast: *what measurement supports this, and would a different
outcome of that measurement have changed the claim?* Here it wouldn't have — I'd have said the
same thing whether A found nothing or found nothing *reportable*, which is the tell that the
claim wasn't resting on evidence.

⚠️ This is **not** one of the five instrument-defect mechanisms (blind spot / contamination /
staleness / non-comparability / unexecuted guard) — those are defects in a measurement. This is an
**audit asymmetry**: the measurement is fine or absent, and the *scrutiny applied to the
conclusion* varies by which way the conclusion flatters the author.

## What was actually established

- **Not supported:** the pool was oversized. Separable, per the peer: *the pool was defensible and
  the runners were broken.* The sizing question stays **open**, not resolved in either direction.
- **Sound sizing input:** +23 compiler lines but a 496-line test, where the subtlety was never the
  fix — it was whether the test could *reach* the code it targeted. Three of the five "look
  hardest" pointers were about test instrumentation, and one (the `SLANG_RUN_SPIRV_VALIDATION`
  abort) is exactly what CI later caught. A pool sized on "23 lines" would have been sized on the
  wrong number.
- **Measured value:** the **brief**, not the runners. Every load-bearing finding the reviewer
  produced started from one of the five dispatch pointers, and the brief survived all three
  runners dying. Open question for next time: *three runners, or a well-aimed brief plus one
  hands-on verifier?*

Related: [[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]] ·
[[feedback_ci_checks_at_a_sha_expire_source_at_a_sha_does_not]] ·
[[feedback_zero_test_jobs_is_not_zero_tests_ran]]
