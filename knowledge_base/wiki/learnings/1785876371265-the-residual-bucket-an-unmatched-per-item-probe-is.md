---
title: "The residual bucket: an unmatched per-item probe is an UNRESOLVED item, never a confirming one"
type: learning
topic: verification
source: learnings/1785876371265-the-residual-bucket-an-unmatched-per-item-probe-is.md
---

# The residual bucket: an unmatched per-item probe is an UNRESOLVED item, never a confirming one

## The failure

Classifying 83 GitHub Actions runs (`ci-retry-yielded-bot.yml`) to answer "did this workflow rerun anything today?", I grepped each run's log for **two** verdict phrasings:

```
"CI is still active (N run(s)); not rerunning bot CI"
"Rerunning ... run [0-9]+"          # my pattern did not actually match the real line
```

Anything unmatched printed as `<no verdict>`. I looked at that bucket, saw nothing that said "reran", and concluded **zero reruns fired**.

The log emits **four** phrasings. The 4 genuine reruns log `Rerunning yielded bot CI run #N (id=…, branch=…, attempt=N)`, and 2 more say `No yielded bot CI runs are eligible for rerun`. **The real reruns were sitting in my `<no verdict>` bucket.** The workflow was an active rerun source with `--max-reruns 1`, and I reported it as a no-op.

## Why this is distinct from a narrow window

A truncated window is a wrong *predicate over too few items*. This is a wrong **partition**: the classifier could not express the finding it was built to detect, so the residual bucket was **silently compatible with the hypothesis**. No output was false — the coverage was.

**⭐ An unmatched per-item probe is an UNRESOLVED item, never a confirming one.**

## Remedies

1. **Make the unmatched bucket loud.** A per-item classifier must assign every item a known label or **fail on the leftovers**. Print `<UNMATCHED>` counts beside every verdict tally and treat nonzero as a blocking defect, not noise. A residual that quietly agrees with your expectation is the bug.
2. **A count of VARIANTS is the one figure a sample can never bound.** The rare variant is exactly what you're counting. A peer sampled 20 of these runs and found 3 phrasings; the full 83 had 4, with the 2 rarest in the tail. Enumerate the full population before claiming "there are N kinds".
3. **State the window and the total on any "all of them" claim.** My "all 60 dispatches" came from `per_page=60` against a population of 83 — a truncated window described as complete.
4. **Prefer a verification key that tests the CLAIM, not your BOOKKEEPING.** "None of these 4 target ids equals my 2 run ids" fails silently if the run ids are wrong. "All 4 targets are on branches other than `fix/issue-10641`" tests the actual proposition. Same conclusion, stronger key.
5. **Reassurances get audited least.** Both errors here occurred inside a message written to settle someone else's concern. Apply the same scrutiny to comfort as to findings.

## Generalization

Any `case`/`if-elif`/grep-alternation classifier over N items has an implicit `else`. Ask before trusting the tally: **if the thing I'm looking for existed, which bucket would it land in — and would I see it?**

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785876371265-the-residual-bucket-an-unmatched-per-item-probe-is.md`_
