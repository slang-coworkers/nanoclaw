---
title: "[approver/human-agreement] slang#12133 MERGED-agreement vindicated across 4 revisions — WOULD_APPROVE @R4 == merged head, jkwak APPROVED + merged same SHA"
type: learning
topic: review-approval
source: learnings/1784391254624-approver-human-agreement-slang-12133-merged-agreem.md
---

# [approver/human-agreement] slang#12133 MERGED-agreement vindicated across 4 revisions — WOULD_APPROVE @R4 == merged head, jkwak APPROVED + merged same SHA

**Outcome:** slang PR #12133 (#9382 Gather const-offset, new IR op kIROp_ImageGatherOffset + emit-time constness) MERGED 2026-07-18T16:12:59Z by jkwak-work (Jay Kwak, real maintainer, is_bot=false; also gave explicit APPROVED "Looks good to me"). Merged head = **fab37124a470 = my R4 WOULD_APPROVE (CLEAN) decision commit exactly** (verified: no follow-up commits between decision and merge; zero human edits after my read). Recorded human_verdict=APPROVED against the R4 row. **AGREEMENT VINDICATED** — not a false-safe, not a disagreement.

**Confirmed-safe shapes (the whole 4-revision chain read correctly):**
- **The fix shape itself:** conditional SPIR-V capability by operand constness via a new backend IR op (delete spirv_asm body + unconditional OpCapability; classify constness at emit on the IR operand). The maintainer-mandated shape — approved & merged as predicted by Step-0 recall. Safe.
- **ConstOffset-hoisting safety chain (R1):** isConstantGatherOffset narrowed to {IRConstant leaf, MakeVector/MakeVectorFromScalar of all-IRConstant} ⊆ the shapes maybeHoistConstructInstToGlobalScope hoists to OpConstantComposite; misclassification safe-only-toward-Offset+capability. This "subset of the hoisting condition" reasoning — which Devin independently affirmed at R4 — held: merged clean. Verifying by code inspection (not by the maintainer's named -target spirv -O0 validation test, which the PR never added) was sufficient and correct.
- **R1→R2 cleanup (comment trim + if-chain→switch):** judged semantics-preserving by byte-identical emit body + logically-identical accepted set. Confirmed safe (merged).
- **R2→R3 module-version bump (k_maxSupportedModuleVersion 25→26):** judged correct/necessary/additive by the design-doc audit. Confirmed safe (merged).
- **R3→R4 master-merge:** judged clean by PR-net-diff byte-identical to R3 (not whole-file blobs). Confirmed safe (merged @ that exact merge commit).

**Calibration takeaways for the next similar review:**
1. A multi-revision fixer chain where each synchronize is a KNOWN-SHAPE delta (cleanup / version-bump / master-merge) and the fix's net contribution stays byte-identical → the prior verified safety carries forward every time; the merge vindicated holding WOULD_APPROVE across all 4 without re-litigating the core fix. Don't inflate these into fresh full re-derivations of the fix — verify the delta class, carry safety forward, record one row per revision.
2. Deciding on a NOT-fully-settled CI (compile-surface legs green, longer legs still running, SlangPy queued) was correct — policy doesn't require CI green and the merge confirmed no causal red ever materialized. The honest "not fully settled, 0 red" framing (forced by codex on R2) is the right calibration — merged clean.
3. An active maintainer APPROVED on the exact head that then merges same-SHA is the highest-confidence agreement signal; it landed here. See [[pr-12133-decided]] and the sibling learnings (ConstOffset-safety-hinges-on-constant-MakeVector-hoisting; synchronize-cleanup-only; module-version-bump-audit; master-merge-verify-net-diff-not-blob).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784391254624-approver-human-agreement-slang-12133-merged-agreem.md`_
