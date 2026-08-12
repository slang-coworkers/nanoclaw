---
title: "[approver/human-disagreement] 3-for-3 over-conservative on slang-rhi import PRs — at n=3 the finding is about the BAR, and the fix is a policy question, not a looser derivation"
type: learning
topic: review-approval
source: learnings/1786342881662-approver-human-disagreement-3-for-3-over-conservat.md
---

# [approver/human-disagreement] 3-for-3 over-conservative on slang-rhi import PRs — at n=3 the finding is about the BAR, and the fix is a policy question, not a looser derivation

# Three consecutive abstains overruled by the same code owner — escalating the bar, not drifting it

**Case that closed it:** slang-rhi#815 @`b50b53c4d1ac` — my `ABSTAIN_POLICY / OPEN_GAP`,
joined 2026-08-10 as human **APPROVED** by `skallweitNV` (the code owner).

| PR | my decision | human outcome |
|---|---|---|
| #813 @`abec21d2fdb4` | ABSTAIN(OPEN_GAP) | APPROVED, merged unchanged |
| #814 @`7b4a6f2ecaac` | ABSTAIN(CHALLENGER_CONCERN) | APPROVED, merged intact |
| #815 @`b50b53c4d1ac` | ABSTAIN(OPEN_GAP) | APPROVED (byte-identical content) |

Same repo, same author (`fknfilewalker`), same approver on two of three. **n=3 consecutive,
zero wins.**

## The join was airtight, because I hashed the files instead of trusting the SHA

#815 synchronized between my decision and the approval, which normally means "he approved a
different thing." **He didn't.** All four PR files are byte-identical across the two heads
(sha256 per file); the only new commit is `Merge branch 'main'`, whose 29 changed lines touch
no decision surface. ⇒ ⭐⭐ **A MOVED HEAD DOES NOT IMPLY CHANGED CONTENT — hash the files
before conceding (or claiming) that a human reviewed something else.** Without that check this
join would have been unscoreable, and a real loss would have quietly vanished.

⚠️ **And a trap in the review metadata:** the approval's `commit.oid` pointed at the NEW head,
but its `submitted_at` was **13 seconds BEFORE that commit existed**. GitHub re-attaches a
pending review to the new head when a sync lands. ⇒ **A review's `commit_id` is the head at
ATTACH time, not necessarily what the human read — cross-check against the commit's own
timestamp.**

## The rule this establishes

⭐⭐⭐ **AT n=3 CONSECUTIVE LOSSES ON ONE SHAPE, THE FINDING IS ABOUT THE BAR, NOT THE PR.**
One overrule is noise; three in a row on the same shape, same repo, same approver is a
measurement of a threshold that is set wrong for this class. Continuing to re-litigate it
per-PR guarantees the same outcome and buries the signal in individual rows.

⛔⛔ **AND THE INFERENCE THAT MUST NOT FOLLOW: "3 losses ⇒ loosen the bar next time."** On this
very PR the critique caught me doing exactly that — importing *"material enough not to merge
as-is"* (a **join-scoring** standard) into a **decision** derivation, which silently swapped a
conservative test for a permissive one in the direction my losses pushed. A scoreboard cannot
authorise a permissive derivation in the moment. ⇒ **THE ONLY LEGITIMATE CHANNEL FOR "THE BAR
IS WRONG" IS AN EXPLICIT POLICY QUESTION TO WHOEVER OWNS THE BAR — carried, never absorbed.**
Absorbed drift is unauditable and indistinguishable from sloppiness; a stated policy question
gets an answer either way.

## Both tiers were wrong, in opposite directions, on one PR

My first pass was `WOULD_APPROVE`. DECISION_REVIEW reversed it to abstain. The human then
approved — **so the critique's reversal is what produced the loss.**

⭐⭐⭐ **That does NOT vindicate the original clearance, and conflating the two is the real
hazard.** My clearance was wrong *as reasoning*: I argued blast radius ("fails closed"), which
the severity bar lists only on the *abstain* side. Right answer, wrong derivation. ⇒ **A
correct outcome reached by an invalid derivation is not evidence the derivation was fine — and
a critique that correctly fixes the derivation can still land on the wrong side of a
maintainer's real standard.** When both a sound derivation and a sound critique lose, suspect
the *bar*, not either tier.

## The falsifiable policy question to escalate

> **Should "a new validation/rejection branch on an import API, untested, whose happy path is
> hardware-verified" clear as ADVISORY rather than routing to `OPEN_GAP`?**

*For clearing:* the untested branch is the **rejection** branch; the happy path executes on
real hardware on two independent runners; the ownership property is settled categorically by
field enumeration; the new code is **stricter** than in-tree precedent (Vulkan's import
type-checks only, no zero-check). Three maintainer approvals say this column wins in practice.

*For holding:* the trigger is reachable from a public API, covered nowhere, and on
**regression** of the guard it fails OPEN into `reinterpret_cast` of an arbitrary handle as a
device pointer.

If maintainers agree, this belongs in `APPROVAL_POLICY.json` as an explicit predicate. If they
disagree, the bar is right and this loss rate is the *intended* cost of shadow-mode
conservatism — also a fine answer, but it has to be **said**, so the rate stops reading as a
defect in the procedure.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786342881662-approver-human-disagreement-3-for-3-over-conservat.md`_
