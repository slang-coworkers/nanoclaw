---
name: feedback_cheap_to_verify_became_substitute_for_verified
description: "I promoted a peer's finding to headline BECAUSE it looked cheap to verify, and that appraisal replaced the verification. Cheapness is a selection effect on what I relay, not evidence."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9e005169-c29b-4ce2-bd35-33d1892f8008
---

⛔ **2026-08-08 — I relayed a peer's "Falcor coverage is under half of nominal" (313 of 744 executions
tested nothing) to the operator as the sweep's PRIMARY finding, ranked above two items I had measured
myself. Truth: genuine unexplained loss was 11 of 744 = 1.5%. I overstated it ~28×.**

⭐⭐⭐ **The tell is in my own words at the moment of promotion.** I wrote that it *"needs no value
judgment, no crash dump, and no ledger it can't support"* — i.e. I ranked it #1 **because it looked
cheap to check**, and then did not check it. One question would have killed it: *what causes the
skips?* The bulk were **draft PRs** (`ci.yml`'s filter job carries `if: draft != true`, so it skips
itself and ~40 dependent jobs cascade) — intended behavior, not lost coverage.

**Why:** cheapness-of-verification feels like a *reason to trust* a finding, because it is genuinely a
reason the finding is *checkable*. Those are different properties. "Easy to verify" is a fact about
the cost of a future action; it says nothing about the claim. So the appraisal that should have
triggered the check became the substitute for it — the inverse of useful caution. Note the direction:
this is a **selection effect on what I forward**, not a measurement defect. My arithmetic was never
wrong; I never did any.

⭐⭐ **Converges with the peer's independent finding the same hour: "the error that survives is the one
whose conclusion I already wanted."** Its own near-miss was a diluted 3.7% AV rate (pooling
`Test (Falcor)` with `Test (Falcor Perf)`, which cannot run that test) that would have shown a 4.5×
local-vs-CI gap — the *more interesting* story, hence the one it was least inclined to audit. Same
shape, two agents, one hour apart: **the claim you want is the claim you don't check.**

**How to apply:** when a finding is about to be promoted, ranked, or relayed, the sentence *"this one
is easy to verify"* is the TRIGGER to verify it, never a substitute. Concretely, for any aggregate
arriving as evidence of a defect: **ask what the number is composed of before ranking it.** A skip
count is not a coverage-loss count; `conclusion` is a status field and does not carry intent
(designed / superseded / cascaded / genuinely lost — only the last is a defect). ⭐⭐ **The
countermeasure that actually worked, twice, was mechanical rather than dispositional: sum-to-
population, and name the denominator's population out loud before dividing.** Caution did not catch
either error; arithmetic did.

⚠️ **Own it at the tier where it landed.** I had already relayed 313/744 to the operator, so the
retraction was mine to send, not the peer's to report — and it had to name which of my "three
compounding mechanisms" survived (1 verified by me, 1 peer-reported and unverified, 1 false) rather
than quietly dropping the count from three.

Related: [[feedback_deference_drifts_to_whoever_corrected_you_last]] (publishing a peer's figure over
my own measurement — same tier, different mechanism), [[feedback_mechanism_must_predict_observed_coordinates]].
