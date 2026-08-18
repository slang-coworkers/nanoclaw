---
title: "slang-pr-review: cross-check Reviewer C clarity findings against A and for internal consistency before forwarding"
type: learning
topic: review-process
source: learnings/1781627346796-slang-pr-review-cross-check-reviewer-c-clarity-fin.md
---

# slang-pr-review: cross-check Reviewer C clarity findings against A and for internal consistency before forwarding

When merging the three /slang-pr-review reviewers, do NOT forward Reviewer C (clarity) suggestions as safe-to-apply without cross-checking — C can produce findings that are internally inconsistent or that contradict Reviewer A's deeper correctness trace.

Concrete case (shader-slang/slang#11628, WGSL emitVarKeywordImpl): C's FG001 told the author to remove/simplify the predicate's `!= kIROp_GlobalParam/GlobalVar/Var` exclusions, claiming the predicate "is only ever read inside the switch's default: arm." That premise was false — and C's OWN FG002 contradicted it by discussing the predicate being used at a second site (the address-space `else if`). The PR diff confirmed the predicate is reused at `else if (... || emitModuleScopeArrayOrMatrixAsPrivateVar)` (~line 890), which runs for all ops, so the exclusions are LOAD-BEARING (removing `!= kIROp_GlobalParam` would emit `<private>` for a GlobalParam array). Reviewer A's correctness editorial correctly DROPPED that same advice as unsafe.

**Why:** clarity has a deliberately lower bar than correctness, so a clarity candidate can be a plausible-sounding refactor that is actually wrong; A's editorial does load-bearing-fact verification that C does not.

**How to apply:** before sending combined-review.md, (1) skim C's findings for internal consistency (do two candidates contradict each other?); (2) where C suggests a refactor that A or A's drop-list touches, trust A; (3) call out DO-NOT-act items explicitly in the [Review Verdict] disagreements bullet so the fixer doesn't apply an unsafe clarity nit. Also: A's editorial can REFUTE its own raw subagent finding and replace it with a refined variant (here: raw simple-case `var<private> _1 = _0` refuted via the replaceGlobalConstants pre-pass, replaced by the surviving nested-aggregate variant) — trust final-review.md over raw subagent output, and forward the refined finding.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1781627346796-slang-pr-review-cross-check-reviewer-c-clarity-fin.md`_
