---
title: "[approver/challenger-miss] removeAndDeallocate-without-use-check pass: prove the op's zero-use invariant, not just this diff"
type: learning
topic: review-approval
source: learnings/1784081016635-approver-challenger-miss-removeanddeallocate-witho.md
---

# [approver/challenger-miss] removeAndDeallocate-without-use-check pass: prove the op's zero-use invariant, not just this diff

**Symptom.** A pre-emit IR pass that unconditionally `removeAndDeallocate()`s an op (no `replaceUsesWith`/use-check first) draws a "deallocated without checking references" static flag from Devin ("Repo rule"). Clearing it as safe requires proving the op *can never have uses* — a property of the op's semantics + all producers/consumers, NOT of the current diff. (slang#11323, `eliminateCastToVoid` dropping `kIROp_CastToVoid`.)

**Root cause / how to clear it.** `removeAndDeallocate` (`slang-ir.cpp:9211`) does NOT assert zero uses (comment only); it drops the inst as a *user* of its own operands via `removeArguments()` but leaves any users of THIS inst dangling. So the pass is sound iff the removed op provably has no users. Proof checklist that cleared it:
1. **Result type** — grep the op's def (`slang-ir-insts.lua`, `core.meta.slang`); if the result is `Void`, no well-typed inst can consume it.
2. **Sole producer** — the op is produced only by one lowering path (here `IRBuilder::emitCast(voidType,·)` from the `(void)expr` intrinsic-init, `slang-lower-to-ir.cpp:966-975`).
3. **Every consumer discards it** — expression-statement lowering (`:8730`) and return-of-void (`:8830`) both drop the value; a void operand elsewhere is a checker type error that never arises (`emitCast` `SLANG_UNREACHABLE`s casting *from* void).
4. **Cross-check** — deepwiki confirmed independently ("result … always discarded and cannot be used as an operand").

**Residual holds worth noting (support ABSTAIN, don't block).** (a) the pass relies on a front-end invariant it never asserts in-pass; (b) traversal is one-level (module globals → IRGlobalValueWithCode → blocks) — clears only because `specializeModule` (conditional on `!isSpecializationDisabled()`, `slang-emit.cpp:1373`) removes generics before the pass, so no nested-generic inner-func CastToVoid survives to concrete emit; (c) `checkUnsupportedInst` has no generic unknown-op catch, so the removal pass is the SOLE safeguard — a missed op still ICEs.

**Fix / transfer.** For any "delete this op before emit" pass: verify the removed op's zero-use invariant from op-semantics + all producers/consumers tree-wide (not the diff), confirm the pass runs on the emit choke point (`linkAndOptimizeIR`) for ALL backends, and check the traversal reaches every place the op can live given prior specialization/inlining. Note test-pinning gaps (SPIRV+HLSL-only here) as advisory since the pass is backend-uniform.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784081016635-approver-challenger-miss-removeanddeallocate-witho.md`_
