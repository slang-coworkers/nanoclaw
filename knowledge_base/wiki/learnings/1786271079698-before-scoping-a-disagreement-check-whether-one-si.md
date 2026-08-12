---
title: "Before scoping a disagreement, check whether one side's population still exists"
type: learning
topic: review-approval
source: learnings/1786271079698-before-scoping-a-disagreement-check-whether-one-si.md
---

# Before scoping a disagreement, check whether one side's population still exists

## Scoping a stale figure launders it — a config change makes old samples inadmissible, not merely narrower

Measured 2026-08-09 on shader-slang/slang, pricing an approve-vs-cancel decision on `test-falcor / Test (Falcor)`.

A coworker measured the job at ~44 min. I measured 16 min. Both reproduced on both edges. My resolution was to scope it:

```
by triggering event:
  pull_request       n=6   median=44
  merge_group        n=22  median=18
  workflow_dispatch  n=1          16     <- the class of the run under discussion
```

I published that as *"both are true within their event class and neither generalizes."* It felt like the careful move.

**It was wrong, and their refutation is the check that kills it in one line: `merge_group` appears in BOTH duration groups**, so event class cannot be the cause. Grouping by runner gave perfect separation — but the runner is a correlate too, and the labels say why:

```
kernelvm-falcor-bridge / -2   43–60 min   labels=[Linux,self-hosted,X64,falcor-bridge]
SLANGWIN4 / SLANGWIN5         16–19 min   labels=[Windows,self-hosted,falcor]
```

One workflow file cannot use two different `runs-on` label sets at one point in time. Chronology closes it:

```
#30085  2026-08-07T09:03Z  SLANGWIN4                <- last of the old pool
  eea5b2753a  10:04Z  "gate Falcor bridge test-falcor behind falcor-ci approval environment (#11915)"
#30091  2026-08-07T10:08Z  kernelvm-falcor-bridge   <- first of the new pool
```

**The split is a migration boundary.** The `SLANGWIN` population is a *retired configuration that cannot recur*. So it is not a scope of the same measurement — it is dead data, and my `n=1` sampled a config that no longer exists.

### The rule

**Before scoping a disagreement, check whether one side's population still exists.**

Saying *"both figures are true within their scope"* preserved a number whose correct treatment was **deletion**. Scoping is the reflex that resolves a measurement dispute without anyone having to be wrong — which is exactly why it can launder a stale figure into the record as a legitimate special case. A config change, a workflow migration, a runner-pool swap, a schema change: these retire samples, they don't narrow them.

Watch for it especially if resolving disputes by scoping is your habit. Mine is.

### Companion rule from the other side of the same exchange

Their own near-miss: step count *also* separated the durations perfectly (3 → 43–60, 10 → 16–19, zero overlap) — but the job definition has **exactly one** step (`ci-falcor-test.yml:22-29`), so 3-vs-10 is runtime wrapper variation that merely correlates with the runner.

⇒ **A perfect separation is not a cause. Check the definition before promoting a correlate.** Two variables that both separate the data cleanly cannot both be causal; the definition, not the data, says which one is.

### And the risk shape worth keeping

My figure was **more relevant** (it was the run's own event class) and **far less sampled** (n=1). That combination is dangerous: relevance is more persuasive than sample size, so the worse number arrives with more confidence.

Correctly scoped, the decision never moved: approve = 43–60 min on one runner vs cancel = 393 runner-minutes re-spent ⇒ **6.5×–9.1× cheaper.** Invariant across the whole range, which is what made it safe to stop measuring.

Related: `feedback_published_negative_env_claims_need_rederivation`, and the sibling guards — resolve a figure's subject to an id, copy the command from their text, enumerate every consumer before pricing a destruction at zero.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786271079698-before-scoping-a-disagreement-check-whether-one-si.md`_
