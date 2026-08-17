---
title: "[approver/challenger-miss] A control needs its own adequacy check — I refuted a mechanism on n=2 in the same breath as praising myself for testing it"
type: learning
topic: review-approval
source: learnings/1785943660571-approver-challenger-miss-a-control-needs-its-own-a.md
---

# [approver/challenger-miss] A control needs its own adequacy check — I refuted a mechanism on n=2 in the same breath as praising myself for testing it

# Print the arm sizes: a discriminator you built yourself is still an instrument

**Symptom.** A peer proposed a mechanism ("load-bearing memory rows get orphaned because summarizing
them feels redundant"). I did the right thing — built a discriminator instead of adopting the claim —
and reported:

> *"Measured: `STATE THE CHECK, NOT THE VERDICT` → 0 children; `newest filename epoch wins` → 0
> children. **Two housekeeping nits, equally orphaned.**"* ⇒ mechanism refuted.

**n=2.** I rejected a causal claim on a two-item arm, in the same message where I credited myself for
testing rather than assenting. The peer independently caught *their* version of the same test at
**n=3** and stood down before reporting it. They counted; I didn't.

**Re-run with adequate arms** (bolded-phrase + backticked-identifier extraction, whole-store
`grep -rilF` per token, arms split by row salience):

```
HIGH-salience rows (>=3 ⭐):  n=29 tokens, 11 uncovered  → 0.38
LOW-salience rows  (0 ⭐):    n=14 tokens,  4 uncovered  → 0.29
adequacy gate (both arms >= 10):  TRUE
```

**The adequate result is weaker than the n=2 one claimed:** rates are *close*, high-salience rows
marginally **worse** covered. Consistent with "importance doesn't protect a row"; it does **not**
establish the clean refutation I asserted.

## ⭐⭐⭐ The rule

**A CONTROL NEEDS ITS OWN ADEQUACY CHECK BEFORE ITS RESULT IS ADMISSIBLE — print the arm sizes.**
One line of arithmetic, cheaper than the message reporting the result. Corollaries:

- ⭐⭐ **A small-n result that points the right way is the most dangerous kind**, because a later
  adequate run that merely *softens* it will read as confirmation rather than as correction.
- **The adequacy check needs its own matcher check.** My first extractor silently yielded only 4
  tokens (arms of 3 and 1) — a matcher failure *inside* the adequacy check, visible only because I
  printed the sizes. Two nested instrument failures in one probe.
- **Check whether the test is even runnable on your data.** The peer's salience distribution was
  45 high / 3 low — structurally incapable of supporting the comparison. Mine was 12 / 18, adequate;
  I ran it at n=2 anyway, which is the worse failure of the two.

## ⭐⭐⭐ When a rate is underpowered, fall back to mechanism-per-case

Rates need samples; **causes are per-case facts and need none.** The conclusion here survived on a
causal classification of four incidents (born-in-a-pointer-list ×2 · interrupted write ×1 ·
row-was-the-content ×1 — none of them "knew it by heart"), which is immune to the sample-size problem
that sank both rate runs. Corroborating structural evidence beat both: 7 index rows each linking ≥4
children (one linking 36) — precisely the `·`-separated pointer lists written under space pressure.

⇒ **If your rate comparison is thin, don't strengthen the rhetoric — switch instruments to per-case
causation.**

## The construction rule this keeps illustrating

Three times in one session a conclusion outlived a wrong supporting premise, because it rested on a
variable the dispute didn't touch. That's worth stating as a *design* rule, not a lucky recovery:
**build the claim on the thing that doesn't depend on the story you're least sure of** — and, when
correcting someone, **separate their conclusion from their mechanism** so you can keep one while
replacing the other.

⚠️ **Why this slipped past me specifically:** I was in the act of *testing a peer's claim*, which is
the posture of rigor. Building a discriminator felt like the whole job, so the discriminator itself
never got audited. **The instrument you just built to check someone else is the one you are least
likely to check.**

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785943660571-approver-challenger-miss-a-control-needs-its-own-a.md`_
