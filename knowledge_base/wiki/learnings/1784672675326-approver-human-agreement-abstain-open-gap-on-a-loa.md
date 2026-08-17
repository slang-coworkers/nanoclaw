---
title: "[approver/human-agreement] ABSTAIN(OPEN_GAP) on a load-bearing peel-set gap → author lands the named one-liner → merged APPROVED (vindicated hold)"
type: learning
topic: review-approval
source: learnings/1784672675326-approver-human-agreement-abstain-open-gap-on-a-loa.md
---

# [approver/human-agreement] ABSTAIN(OPEN_GAP) on a load-bearing peel-set gap → author lands the named one-liner → merged APPROVED (vindicated hold)

**Symptom / outcome:** slang#12119 (OptiX SBT __ldg exclusion, successor to the #11152 false-safe) ran a 4-revision approval chain: R1/R2 WOULD_APPROVE → R3 ABSTAIN_POLICY(OPEN_GAP) → R4 WOULD_APPROVE. R3's ABSTAIN was because the SBT walker `isAddressIntoOptiXShaderBindingTable` omitted `kIROp_PtrCast`, a load-bearing gap (SBT ptr is ConstantBuffer→Uniform AS, which the predicate treats as immutable, so a walker miss falls through to TRUE→__ldg→stale read). The approver named the exact one-line fix. R4 was the author landing precisely `+kIROp_PtrCast`. The PR then **merged APPROVED** (jkwak-work APPROVED, reviewDecision=APPROVED, genuine independent maintainer sign-off). So the whole arc validated: the ABSTAIN was a real correctness catch that shaped the final merged code, not over-caution.

**What worked:** (1) The codex DECISION_REVIEW gate caught my initial R3 "failure-direction-safe" over-claim (I'd assumed a walker-miss returns false/mutable; codex proved ConstantBuffer→Uniform→immutable→miss returns TRUE=bug). Running the critique gate hard on the exact file where we'd been wrong before (#11152) is what turned a would-be false-safe into a correct ABSTAIN. (2) At R4, a scout subagent (haiku) hypothesized a NEW residual-cast bug (`CastStorageToLogical` un-peeled on the CUDA SBT chain); I did NOT take it at face value — verified against the pass source that `materializeStorageToLogicalCasts()` eliminates those casts before the __ldg pass, and had codex adjudicate. Plausible-but-wrong scout hypotheticals must be verified against source, not trusted or reflexively acted on.

**SHA-verify-first paid off (the join half):** on the pr_merged webhook I verified the merged head against live GitHub BEFORE stamping. The merged head was `e5c7b14f3209`, NOT my R4 head `7d12d5a8224b` — 5 days and a rebase-onto-master (+34/-1, mostly .github CI churn) plus minor edits later. The load-bearing SBT walker was byte-identical at the merged head to R4, so R4's decision content is what merged; but the merged SHA itself was never decided. Recorded human_verdict=APPROVED against R4 (content that merged) and R3 (the vindicated hold) — NOT against a SHA I never decided. **Rule reaffirmed: a pr_merged webhook does not mean "merge = your last decided SHA"; diff the merged head vs your decided head, confirm the decision-relevant logic is unchanged, and stamp the row whose content actually merged. Watch for scope additions at the merged head (here: a new unrelated cuda-prelude-vec1-make.cu test) that were never in your decision.**

**Calibration:** R4 WOULD_APPROVE = agreement (hit). R3 ABSTAIN = vindicated (fix-then-approve). The R2→R3(ABSTAIN)→R4(fix)→merge(APPROVED) loop is the #11152 discipline end-to-end — an ABSTAIN that names the precise fix is high-value, not a non-answer.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784672675326-approver-human-agreement-abstain-open-gap-on-a-loa.md`_
