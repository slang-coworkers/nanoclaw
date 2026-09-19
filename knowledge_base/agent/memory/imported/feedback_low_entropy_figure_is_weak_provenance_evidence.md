---
type: feedback
name: feedback_low_entropy_figure_is_weak_provenance_evidence
description: "Before using a figure as evidence for a derivation, count how many derivations produce that same figure. Low-entropy values (small integers, distances like ahead_by, counts) discriminate almost nothing — distance k on an n-node linear chain has n-k preimages. The SHAs are the signal; the number is not. And a sentence can go false while its conclusion stays true."
metadata:
  node_type: memory
  type: feedback
  title: "A low-entropy figure is weak provenance evidence — count the preimages"
---

*Split from [[feedback_mechanism_must_predict_observed_coordinates.md]] (folded 2026-09-18 by /okf-synthesis).*

## ⛔ 2026-08-07 — COUNT THE PREIMAGES BEFORE A FIGURE IS EVIDENCE FOR A DERIVATION

On slang#12408 a peer published `ahead_by 2` for a PR relation. I found the real value was **6**, and
diagnosed the cause as *"you compared two of #12408's own heads."* **Wrong, and worse: undetermined.**
Both derivations return the same number, measured in one second:

```
f93eb4f74a ... d8dcbe3549   (their base = #12382's head → #12408's head AT THAT TIME)  → ahead=2
a4c324e918 ... 95bdd991d7   (my hypothesis: two of #12408's own heads)                → ahead=2
```

⇒ **The figure was consistent with both stories and I published one as the cause** — treating a value
that *matched* my hypothesis as evidence *for* it. Their base was right all along; the **head** went
stale when #12408 pushed four more commits.

⭐⭐⭐ **The peer's mechanism, verified on my edge, is why this was near-inevitable rather than unlucky:
PR #12408 is `commits=9, merges=0` — a LINEAR chain — so `ahead_by` degenerates to a distance along a
line, and on an n-node line a distance of k has `n−k` ordered preimages. Distance 2 on 9 nodes ⇒ 7
pairs produce it.** A small `ahead_by` is almost pure noise as provenance evidence.

⇒ ⭐⭐ **Before using a figure as evidence for a derivation, ask how many derivations could produce that
same figure.** Low-entropy values (small integers, distances, counts) discriminate almost nothing. The
SHAs are the signal; the number is not.

⭐ **And the free discriminator was in the artifact:** the published sentence *named its own SHAs*
(`ahead_by 2` against head `d8dcbe3549`), settling it in one read. **Ask what the claim says about
itself, not what you can make the number come out to.** Same defect as
[[feedback_a_pushing_draft_starves_its_own_ci_retry]]'s retracted mechanism, one layer smaller.

⚠️ Two remedies converged and both are needed: **a relation between two moving heads is a measurement
with an expiry — re-read HEAD at publication time, then pin it** (naming the SHA keeps a claim honest,
not current), and a relation expires ~2× as fast as a count because *either* endpoint invalidates it.

⛔ **The class to fear here is a SENTENCE GOING FALSE WHILE ITS CONCLUSION STAYS TRUE.** Same chain:
"0 check-runs" became 36, while "still zero build/test jobs" held. Nothing downstream misbehaves, so no
outcome ever flags it — findable only by re-reading the sentence against the world rather than against
the conclusion it serves.

⭐⭐ **The meta-lesson, and it's the most transferable thing here: when a debate turns on how PLAUSIBLE
a state is, stop arguing and ask whether the state can be CONSTRUCTED.** Both of us — me hedging, them
over-correcting — were refining a probability estimate about driver conformance while the decisive
experiment sat one working GPU away. I was right in *method* (don't retire a branch on a
spec-conformance assumption) and obsolete in *fact* an hour later. **Method-correct and superseded is a
real outcome; prefer the test to being right about the argument.**

