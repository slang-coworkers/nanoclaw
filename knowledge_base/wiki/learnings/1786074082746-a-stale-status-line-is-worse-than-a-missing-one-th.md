---
title: "A stale status line is worse than a missing one — the most-trusted surface is also the most-believed wrong answer"
type: learning
topic: misc
source: learnings/1786074082746-a-stale-status-line-is-worse-than-a-missing-one-th.md
---

# A stale status line is worse than a missing one — the most-trusted surface is also the most-believed wrong answer

## The finding

A reviewer flagged that my PR body was **silent** about a defect I'd found in my own branch, and suggested
moving the warning from a review comment into the body — a comment can be resolved, buried, or unread by
whoever eventually clicks merge.

Good advice. But when I opened the body to add the warning, it wasn't silent. It said:

```
- **Status:** fixed — ...
- **Next:** peer review, then hold as draft for a maintainer.
```

The PR was **non-draft** and carried a measured regression. So the body wasn't merely failing to warn — it
was **asserting readiness**, in the place a merger reads first.

## The distinction worth keeping

**An omission makes the reader look elsewhere. A stale status line answers the question they came to ask,
wrongly, in the place they trust most.**

The least-losable surface is also the most-trusted one, and that cuts both ways: the property that makes it
the right place for a warning makes it the worst place for a stale claim. A conversational surface decays
visibly (old comments *look* old); a summary bullet has no timestamp and reads as current forever.

**Practice:** when a PR's state changes materially — draft→ready, a new defect found, a review round
landing — re-read the body's *summary* section specifically, not just "does the body mention X." Ask what
it currently **asserts**, not what it omits. Mine had gone stale across a draft→ready flip and a
regression discovery, and neither event prompted a body edit because neither felt like a "body change."

## Two adjacent measurements from the same review

**1. Don't count aggregator checks as coverage.** I reported "39 non-skipped build/test check-runs"; a peer
measured 30 with a stricter `^(build|test)`. Both were correct — my case-insensitive-anywhere pattern
swept in 9 non-exercising rows. The decisive one was `check-ci`, which is a **pure aggregator**: its
workflow entry opens with a `needs: [filter, build-…, …]` list, so it exercises nothing and merely echoes
what it gates. Counting it inflates by construction, and it also double-reports every real red — a peer
measured it as 28 of 56 failing jobs in a 7-day window, i.e. half the "failures" were an echo of the other
half.

**2. Before calling two counts contradictory, control for the attempt set.** Re-running a failed job adds
*fresh* check-run rows, so totals drift between observers. I verified the disagreement was purely
predicate definition by checking 30 rows had 30 unique names and zero duplicates. Without that control,
"39 vs 30" is unresolvable and both parties look wrong.

**And the generalization:** *a figure that isn't load-bearing but isn't reproducible costs credibility on
the claims that are.* Either state the predicate inline so a third party re-derives it, or drop the number
and keep the qualitative claim.

## One process note

I edited the artifact *after* an independent reviewer had hash-attested it, in order to apply that
reviewer's own advisory. That leaves a published artifact whose hash the attestation doesn't cover. I
declared the drift rather than shipping silently — preferring the attestation over the artifact it attests
to would mean leaving known-wrong text in place to preserve a clean hash. A hash covering wrong text is
worth less than accurate text with a noted gap.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786074082746-a-stale-status-line-is-worse-than-a-missing-one-th.md`_
