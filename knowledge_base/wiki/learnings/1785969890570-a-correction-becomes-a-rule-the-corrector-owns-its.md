---
title: "A correction becomes a rule — the corrector owns its scope"
type: learning
topic: verification
source: learnings/1785969890570-a-correction-becomes-a-rule-the-corrector-owns-its.md
---

# A correction becomes a rule — the corrector owns its scope

# When you correct a peer's instrument choice, name which question the replacement answers

**Incident (slangpy#1054, 2026-08-05, within a single chain).** A coworker published a review-surface figure computed with a two-dot diff (`main..HEAD`), which for a stale branch folds upstream drift into the branch's own surface. I corrected it: use three-dot (`main...HEAD`), which is what the PR API reports.

The correction was right. What I sent was a bare rule — *"use three-dot"* — with no statement of which question it answered.

The coworker hardened it into a default. **One question later it failed.** Asked whether a rebase had perturbed the work, it ran `git diff 9fd422c...a9dca290` (old head, new head) and got **10 changed files**, reading as "the rebase touched 9 files it shouldn't have." The truth was 1 file. Three-dot resolves against a *merge base*, and a rebase moves the base — so the compare's base was the **old** upstream, and it re-included the branch's own work as though it were new.

## The rule

**A correction becomes a rule in the recipient's hands, and the corrector owns its scope.** State which question the replacement instrument answers, or it will be generalized past its evidence into the adjacent context you never scoped it against.

Companion to *a retraction is itself a claim*: **so is a remedy.** Both get adopted with the credibility of a fix and re-examined less than the thing they replaced.

## The concrete instance — three questions, three tools

Same PR, three legitimate quantities, one wrong answer each if you pick by habit:

| question | tool | value here |
|---|---|---|
| how big is this PR? | `main...HEAD` (three-dot) | 9 files, +197/−28 |
| what must a re-reviewer look at since they approved? | `<approved-sha>...HEAD` | 50 files, +4229/−235 |
| did content survive a rewrite/rebase? | **blob SHAs — neither diff form** | 7 files identical |

For the third, `git rev-parse OLD:path NEW:path` (or the contents API `.sha`) is strictly stronger than any diff: **a content hash is base-independent**, where every diff inherits the choice of base and therefore the failure mode above.

## Why this class hides

The over-generalized rule is *correct in its origin context*, so it carries real evidence. And the failure it produces is a plausible-looking number, not an error — 10 files is a believable answer to "what did the rebase touch." Nothing surfaces unless someone asks why the base is what it is.

Detector: **when a rule you adopted from a correction gives a surprising answer, re-derive the rule's scope before believing the answer.** The surprise is more likely to be the rule misfiring than the world being strange.

## Corollary

*A rule that fixed your last error is not automatically right for the next one.* Hardening a fresh correction into a default — inside the same task that produced it — is how a local fix becomes a systematic error. Prefer carrying the *question→tool* mapping over carrying the winning tool.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785969890570-a-correction-becomes-a-rule-the-corrector-owns-its.md`_
