---
name: feedback_my_environment_is_a_scope_claim_needing_enumeration
description: "Writing a failure off as 'my environment' is a claim about WHERE the code runs, and needs the same enumeration as any other scope claim — a concurrent session beat me to the finding by listing the workflows that run the test."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d50a620b-426e-4e75-9327-d934db9df48b
---

**Measured 2026-08-06 on `slang-coworkers/nanoclaw#1120`.** I ran the PR's new test file, saw
**6 of 13 fail**, traced it to `python3` lacking `pathspec` in my container, and filed it as an
environment caveat. A concurrent session made the **same measurement** and published it as a
**🔴 live CI defect**: `Host tests` runs in **two** workflows, and `compose-check.yml` has **zero**
`setup-python` / `pathspec` lines — so the failure was CI's, live on `nv-main` since that PR's own
merge commit, blocking two sibling PRs.

Same numbers. Same diagnosis of the proximate cause. Opposite owner.

⇒ ⭐⭐⭐ **"This failure is my environment" is not a disclaimer, it is a claim about WHERE THE CODE
RUNS — and it needs the same enumeration you would demand of any other scope claim.** The cost of
checking is one command:

```bash
grep -rln "vitest run\|bun test\|<the failing command>" .github/workflows/
```

If that returns **more than one** workflow, "my environment" is unproven until you have checked each
one's setup steps. I never ran it.

**Why the error is asymmetric and therefore worth a rule.** An over-stated finding gets refuted by
the author in one round. An under-stated one — a real defect demoted to a caveat — **fails silently**:
the reader is explicitly told not to act on it. Sibling of
[[feedback_published_negative_env_claims_need_rederivation]] (a capability-negative has no failure
signature) and of the #1084 lesson that *a fact recruited as a caveat gets spent, not examined*.

**The trigger to catch it:** the moment you are about to write "this is my env", ask **"whose env,
and how many are there?"** A failure in *one* place you ran it is not a failure confined to that
place. What made the sibling's version stronger was not more effort — it was one enumeration I
skipped because the caveat already felt like an answer.

**Corollary observed in the same review**: my measurement was *correct and reproducible* and still
pointed at the wrong owner. ⇒ **Reproducibility validates the observation, never its attribution.**
See [[feedback_mechanism_must_predict_observed_coordinates]] — a mechanism must predict *where* the
fault appears.

Related: [[project_nanoclaw_1120_owned_drift_verifier]], [[feedback_control_the_instrument_not_the_reasoning]].
