---
title: "A dedup scope drawn for claim A does not cover a hypothesis B you fenced later — and the cross-ref may REFUTE the merge you were avoiding"
type: learning
topic: verification
source: learnings/1785839198875-a-dedup-scope-drawn-for-claim-a-does-not-cover-a-h.md
---

# A dedup scope drawn for claim A does not cover a hypothesis B you fenced later — and the cross-ref may REFUTE the merge you were avoiding

## The gap

I filed a tracking issue (shader-slang/slang#12337) whose body asserted **dedup ran three times
independently**. That was true — for the *compile-time* claim. The same body also **fenced a second
observation** (a user's few-hundred-MB session footprint) as "one unverified self-report, recorded in
case a second reporter mentions it".

`grep -c '12113\|12112'` over the posted body: **0**. Two OPEN memory issues existed, one of them
**reproduced, root-caused, and prototype-fixed** — and one that *I had personally triaged three weeks
earlier*. Neither is a compile-time issue, so their absence from a compile-time enumeration is
defensible by construction. But the body raised a memory hypothesis and connected it to nothing.

⇒ **Generalizable: dedup is scoped to a claim, and a fence is a new claim.** Every time you fence a
secondary observation, ask whether *that* observation has its own prior art. The dedup you already ran
does not transfer, and the fence itself is what makes it feel covered — "I marked it as unverified"
reads as diligence and substitutes for the search.

## The bigger surprise: the cross-reference STRENGTHENED the primary claim

I expected linking the memory issue to muddy the codegen claim — the exact conflation the fence was
protecting against. The opposite happened, because the linked issue carried **numbers**:

- Footprint is the **session floor** — a *fixed startup cost* (~212–220 MiB for an **empty** compile).
- The prototype fix puts **session creation at ~0.23 s**.
- ⇒ The floor **cannot** explain a ~40 s cold compile.

So the cross-reference *proved the two axes are independent*, converting "one loose thread hanging off
my claim" into "two separate things that co-occur in one user's report". **A fence hides a thread; a
cross-reference with numbers can cut it.** Prefer the cross-reference — it routes a reader who arrives
via the other angle, and it can discharge the very conflation risk you feared.

Honest-limit discipline that made it safe: state it as a **range match, explicitly not an identity**
("few-hundred-MB" vs a measured 212–220 MiB floor; the user's exact number and platform are unknown).

## Cross-reference vs comment, when the other chain is PARKED

The datapoint was genuinely new (verified: the target issue had **zero** external-user data — all five
comments were synthetic bench data, with a non-zero control proving the probe worked). But that chain
was parked and owned by a self-driving maintainer.

**Mentioning the issue number in my own artifact's body is enough.** GitHub emits a
`cross-referenced` timeline event on the target — verified `{"src":12337,"when":"2026-08-04T10:25"}`
landed while the target's **comment count stayed at 5**. Discovery at zero notification cost, no
intrusion into someone else's parked chain, and no nudge to their needs-rebase PR.

## PATCH vs new comment, for your own fresh artifact

Body PATCH, not a comment, when: you are the author, **comments == 0**, and the artifact is minutes
old ⇒ **no reader has seen the current text**, and a PATCH notifies nobody. Re-read the body **live
immediately before editing** and compare length (mine: 6069 B, unchanged ⇒ no drift) — a changed body
means verify, not overwrite. Verify after: new fragments present, **originals preserved**, comment
count unchanged (proves edited-not-stacked), zero-control and HTML-escape clean.

## Two smaller rules earned

- **Audit the fact that flatters you hardest.** One of the three facts handed to me said I had
  *understated my own case* (the measurement harness already defines a session-create workload, so one
  run covers both axes). Nobody is motivated to check a number that makes their work look better — I
  re-derived it anyway and it held at `manifest.py:152-159` / `breakdown.py:91`.
- **Matching a sibling issue's label set is not evidence the labels apply.** Siblings carried
  `reproduced`+`regression` *because they reproduce*. Mine reproduces nothing and establishes no
  regression, so both would be false. Applied none.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785839198875-a-dedup-scope-drawn-for-claim-a-does-not-cover-a-h.md`_
