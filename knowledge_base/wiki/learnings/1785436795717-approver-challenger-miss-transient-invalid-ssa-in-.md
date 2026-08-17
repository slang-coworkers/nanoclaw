---
title: "[approver/challenger-miss] transient-invalid-SSA in IR reconstruction is NOT auto-benign: 'throwaway container never transposed' lean was WRONG on slang#12095"
type: learning
topic: review-approval
source: learnings/1785436795717-approver-challenger-miss-transient-invalid-ssa-in-.md
---

# [approver/challenger-miss] transient-invalid-SSA in IR reconstruction is NOT auto-benign: "throwaway container never transposed" lean was WRONG on slang#12095

## Challenger calibration miss — slang#12095 SSA-dominance 🔴

**Context:** CodeRabbit flagged a 🔴 in `slang-ir-autodiff-transpose.cpp` (`promoteOperandsToTargetType` / `transposeArithmetic`): the pass built a forward-block `newInst` that referenced a primal `newOperand` placed at `oldLoc` in the REVERSE block — transient invalid SSA (a forward-block inst using a value defined later, in a different block).

**My challenger LEANED FALSE-POSITIVE**, reasoning: "the reconstructed container is a throwaway never actually transposed; the forward block is `removeAndDeallocate()`'d wholesale later; debug IR-validation test-slang is green." I could NOT prove no verification pass observes the transient invalid SSA, so I correctly did NOT clear it — but my *lean* was that it was benign.

**That lean was WRONG.** The author (saipraveenb25) fixed it before merge (commit "Preserve SSA when promoting autodiff operands"): deleted the reconstructed-inst path entirely, returning the promoted operand list instead. His code comment states the invariant the old code violated: *"A differential promotion belongs in the forward block, while a primal promotion belongs at its reverse-mode use, so no single block can hold a reconstructed instruction that references both kinds while preserving SSA dominance."* kaizhangNV then APPROVED the revised head.

**Symptom:** Challenger dismisses a transient-invalid-SSA / dominance-violation 🔴 as benign because the malformed inst is "thrown away" or "never consumed."

**Root cause:** "The bad shape is deleted before it matters" is NOT a proof of safety. It assumes (a) no intervening pass/validator observes it, AND (b) the author intended the shape — both unproven. A dominance violation in SSA IR is a representation bug regardless of whether one specific downstream path happens to tolerate it (echoes the slang CLAUDE.md rule: don't accept a malformed IR shape just because a consumer survives it; fix the producer).

**How to catch it:** When a 🔴 alleges a transient SSA/dominance violation in an IR pass, DO NOT lean FP on a "throwaway / deleted-later" narrative. Treat it as an unrefuted representation concern → CHALLENGER_CONCERN / ABSTAIN. The safe test is "is the intermediate shape well-formed by construction?" not "does it get cleaned up?" A benign verdict requires proving the producer only ever emits dominance-valid IR.

**Fix:** raise plausibility weight on cross-block operand-placement 🔴s in autodiff transpose specifically — differential-vs-primal insts belong in different blocks (fwd vs reverse-use), so any reconstruction referencing both is a dominance smell. The policy of holding-at-ABSTAIN saved the decision here even though the challenger's lean was wrong; but the correct challenger read is "this is likely real," which would have strengthened toward the same ABSTAIN with a truer rationale. Related: [[pr-12098]] false-safe (representation gap wrongly cleared as advisory).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785436795717-approver-challenger-miss-transient-invalid-ssa-in-.md`_
