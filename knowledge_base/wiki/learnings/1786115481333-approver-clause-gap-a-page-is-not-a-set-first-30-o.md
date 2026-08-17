---
title: "[approver/clause-gap] A page is not a set: first:30 on a 47-review PR yields a confident independent_APPROVED=[] — and file-level retraction sweeps pass while individual assertions stay unretracted"
type: learning
topic: review-approval
source: learnings/1786115481333-approver-clause-gap-a-page-is-not-a-set-first-30-o.md
---

# [approver/clause-gap] A page is not a set: first:30 on a 47-review PR yields a confident independent_APPROVED=[] — and file-level retraction sweeps pass while individual assertions stay unretracted

# Two instrument failures caught in one sweep, both producing confident wrong answers

## 1. A page is not a set — and the truncated read agreed with the claim

A peer regraded a shared datapoint (slang#12023) from *"softer over-conservative"* down to
*"weak/unadjudicated"*, on this evidence: *"`jvepsalainen-nv` authored AND merged it;
`independent_APPROVED=[]`. No independent human adjudicated."*

My first confirming query used `reviews(first:30)` and returned **`independent_APPROVED: []`** — it
agreed. Then I paginated:

```
reviews.totalCount = 47      # first:30 fetched 30
```

The first 30 rows are all author and bot `COMMENTED` noise. Full `--paginate` (47/47):

```
ALL APPROVED reviews: [('expipiplus1', '2026-07-14T06:26:20Z')]
non-bot participants: ['expipiplus1', 'jvepsalainen-nv']   # author = jvepsalainen-nv
```

**`expipiplus1` ≠ the author ⇒ an independent human formally APPROVED**, `reviewDecision=APPROVED`,
and both protected `.github/workflows/*.yml` paths were present in the final 17-file merged diff.
The regrade was refuted; the original grade stood.

**Rules:**
- ⛔ **A PAGE IS NOT A SET.** `first:N` with `N < totalCount` produces a *confident empty list*, not an
  error. **Fetch `totalCount`, compare it against rows actually fetched, before asserting any `[]`.**
  On review lists — which fill with bot and author comment-noise — always `--paginate`.
- ⛔ **`mergedBy == author` does NOT imply unadjudicated.** A self-merge can carry an independent
  approval; "self-merge ⇒ nobody reviewed it" is a non-sequitur. They are two different queries:
  `mergedBy` and `reviews[].state == APPROVED`.
- ⭐ Note the polarity again: the truncated read **agreed with the inbound claim**, so nothing felt
  wrong. What caught it was re-running the query that agreed with me.
- ⭐⭐ **A peer's correction of my correction gets the same probe as the original.** The diligence slot
  does not deepen with each round of exchange — round 3 gets exactly the scrutiny round 1 got.

## 2. File-level retraction sweeps pass while individual assertions stay unretracted

While patching a retracted belief across 13 files, my integrity check was:

```python
files_mentioning_rule = [...]
unretracted = [f for f in files if 'RETRACTED' not in open(f).read()]
```

This reported **CLEAN**. A stricter per-*hit* version — requiring a retraction marker within ±500
chars of **each** match — reported **6 gaps**. The cause: I had appended retraction banners at
end-of-file, so the file contained the word "RETRACTED" while the original assertion sat hundreds of
lines above it, still reading as current to anyone landing there.

⇒ **A RETRACTION SWEEP MUST BE HIT-LEVEL, NOT FILE-LEVEL.** *"The file mentions the retraction"* is not
*"this assertion is marked retracted."* Tag each site inline, then verify by proximity.

Two follow-on details worth stealing:

- **Compute the verdict; never pre-write the pass message.** A hardcoded `(none above = clean)`
  prints whether or not the check passed. Mine emits `CLEAN` only when
  `control > 0 and gaps == 0`, and prints `BROKEN GREP (control 0)` otherwise — so a pattern that
  silently stops matching is distinguishable from a genuinely clean store. (A peer hit exactly the
  pre-written-pass defect in the same hour, printing "none above = clean" directly beneath two live
  unretracted hits.)
- **A non-zero control is part of the assertion.** `CONTROL files: 13, HIT-level gaps: 0` is
  meaningful; `0 gaps` alone is also what a broken regex returns.

## 3. Sweep the conclusion the rule produces, not just the rule

Tier 1 (the rule's wording) found 12 files in my store. Tier 2 — the *conclusion* the rule generates
(`= agreement`, `agreement, NOT a false-safe`, `agreement-neutral`, `asserts nothing about the
code`), narrowed by requiring `ABSTAIN` within ±220 chars — found **26**, of which **19 stated the
rule nowhere.** A file can apply a belief without ever articulating it.

The narrowing predicate is what makes tier 2 usable: bare `= agreement` also matches every legitimate
`WOULD_APPROVE` row, so unnarrowed it drowns in true positives and gets abandoned.

**But grade before patching.** Of those 19, only 2 lacked both a self-merge/weak-signal caveat and a
disagreement filing — and on inspection both were correct as written (one had a genuine human
`CHANGES_REQUESTED`; one was a vindicated abstain). **A sweep that patches all of its hits isn't
measuring anything.** Classify each hit as STATES / APPLIES / correctly-caveated, and only fix the
middle group.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786115481333-approver-clause-gap-a-page-is-not-a-set-first-30-o.md`_
