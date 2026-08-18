---
title: "Don't COMPUTE a correction for an untrustworthy number — re-measure it; a derived offset carries the confidence of having checked while pointing the wrong way"
type: learning
topic: verification
source: learnings/1786033954136-don-t-compute-a-correction-for-an-untrustworthy-nu.md
---

# Don't COMPUTE a correction for an untrustworthy number — re-measure it; a derived offset carries the confidence of having checked while pointing the wrong way

## What happened

I drafted a PR body's `file:line` citations, then noticed I'd been working across a tree-state change
(the fix was `git stash`-ed for a revert drill). Correct instinct: **citations can't be trusted across
a tree-state change.** Then I did the wrong thing with it — I wrote a note predicting the correction:

> "the post-fix line numbers shift by ~+83 lines relative to the baseline tree"

Every part of that was wrong, and a reviewer caught it:

- **The sign was inverted.** A +103-line insertion moves code to *higher* line numbers. My cited
  `:2509` was *larger* than the fix-absent `:2442`, which meant I had drafted against the **patched**
  tree and the citations were **already correct**. Following my own note would have made me subtract
  the offset and ship the fix-absent positions — wrong lines, in a file my patch modifies.
- **There is no single offset.** Measured: `AddOverloadCandidateInner` `2442 → 2509` = **+67**;
  `CompleteOverloadCandidate` `3744 → 3778` = **+34**. A patch inserts at multiple points, so any
  global correction corrupts part of the list. My "~+83" was a fabricated average.
- **A correction is the least-audited claim.** Applied in the wrong direction it is worse than no
  correction, because it carries the confidence of having checked.

## The rule

**The remedy for an untrustworthy number is to MEASURE it again, not to DERIVE a correction from an
assumed direction.** One `grep -n <symbol>` in each tree settles it; predicting an offset settles
nothing and manufactures a new error.

```bash
# right: re-grep each symbol in the tree the citation will describe
grep -n "^void SemanticsVisitor::AddOverloadCandidateInner" source/slang/slang-check-overload.cpp
# wrong: cited_line - assumed_offset
```

Practical checklist when citations cross a tree-state change (stash/unstash, rebase, worktree swap):
1. Identify **which tree** each number was read from (patched vs unpatched, pre- vs post-rebase).
2. Re-grep **every symbol individually** in the tree the PR will be read against.
3. Expect to **confirm**, not adjust — and if a number does move, take the measured value.
4. Never apply one offset to a list of citations.

## Generalization

This is one level up from *measure, don't recall*: **don't do arithmetic on measurements either.**
Recall and derivation are both substitutes for looking, and derivation is the more dangerous of the
two because it produces a specific, plausible number with no observation behind it.

Note the self-inflicted trigger: a **revert drill** (stash the fix, rebuild, prove the test fails)
is a valuable control, but it changes the tree under your citations. The drill is worth the cost —
just don't trust any `file:line` you wrote on either side of it until re-grepped.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786033954136-don-t-compute-a-correction-for-an-untrustworthy-nu.md`_
