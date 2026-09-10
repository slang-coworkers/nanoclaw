---
name: project-12219-sccp-module-scope-composite-const-fold
description: "#12219 module-scope DescriptorHandle round-trip ICE (E99997). Fix pivoted SCCP→peephole; shipped same-width round-trip cancel in PR #12263, merged 2026-08-01. Follow-up discharged; cross-width residual tracked on #12186."
metadata:
  node_type: memory
  type: project
  originSessionId: f1d7131c-25f1-4b0d-a50b-9a32585f50b6
---

# #12219 — fold module-scope DescriptorHandle round-trip constants before SPIR-V emit

**Terminal (positive).** PR **#12263 MERGED 2026-08-01 (merge commit
`4d8fa2e9d1`)**; issue #12219 auto-closed `completed`. Split off from PR #12186
review at @pdeayton-nv's request; filed by nv-slang-bot.

## Problem
ICE `E99997 "Unhandled global inst in spirv-emit"` on valid module-scope
`static const` vector/composite initializers built from a `DescriptorHandle`
round-trip (e.g. `uint2 ↔ DescriptorHandle` rep casts). `applySparse...ForGlobalScope`
ran before emit but couldn't collapse these.

## Fix (what actually shipped — after a mechanism pivot)
The final fix is a **targeted peephole in `slang-ir-peephole.cpp`** cancelling
the **same-width** DescriptorHandle round-trip
(`CastDescriptorHandleToUIntN(CastUIntNToDescriptorHandle(x)) -> x`, uint2 +
uint64, 2 inline cases, no helper) + 3 same-width regression tests + 1 WGSL check
update. `tests/spirv` 558/558. Cross-width (`bit_cast<uint2>(uint64)`) was
deferred to #12186. The re-exposed inner constructor folds to
`OpConstantComposite`, and the float→int case (`(uint2)float2(3.0,4.0)`) rides
along for free once the wrapper is removed.

## The pivot (durable, why the diff looks the way it does)
The fix **started as an SCCP change** (extend `isEvaluableOpCode` +
scalar/packed-float eval gate to admit MakeVector/composite/cast ops). Adversarial
review caught two real bugs the fixer had introduced in that approach (R1: splat
`MakeVectorFromScalar` OOB read; R2: `bit_cast<scalar>(constVector)` null-deref
segfault). Then **@pdeayton-nv directed a wholesale mechanism change: revert SCCP
entirely, do a peephole instead** — cleaner, and the whole R2 bug-class can't recur
(no lattice changes). A later @csyonghe vs @pdeayton scope tension (helper
complexity vs cross-width support) was resolved **same-width-only**, which
satisfied both maintainers.

## Follow-up status (the DO-NOT-COMPRESS obligation, now discharged)
The float→int follow-up that a prior session flagged as owed is **discharged**:
the peephole fixes `(uint2)float2(3.0,4.0)` too (empirically verified post-merge),
and the genuine residual — the **width-mismatch** `bit_cast<uint2>(uint64)` case
(still E99997, contrived module-scope construct, compile-time ICE, no shipped-code
miscompile) — is **durably tracked on the open #12186** (comment 5150492632,
framed as a concrete in-scope reproducer for its cross-width scope). Nothing
outstanding. See [[project_12185_bindless_texture_nv_desc_handle_nonimage]] (#12186
neighborhood).

## Lessons (durable)
- **Trust the specialist's root-cause analysis over a parent's symptom-fix.** The
  fixer/reviewer's source-verified reasoning drove every correct call here.
- **A refinement or obligation filed ONLY into the project file where it was
  discovered is functionally discarded** — the store holds it but nothing prompts
  re-derivation, so the gate silently expires. (This file itself once carried an
  unindexed owed action for 2 days.) Obligations belong on the tracked issue/PR,
  not buried in a memory leaf. See [[feedback_mechanism_must_predict_observed_coordinates]].
- **Adversarial peer review earned its keep** — 2 rounds caught 2 real
  fixer-introduced bugs; the fix shipped materially stronger.
- **Concurrent `/slang-pr-review` runs sharing `tmp/pr-diff.patch` produce
  false-positive Reviewer-A INTEGRITY-FAILs** (fired 3× on this chain); each was
  caught by the run's own footer diff-hash. The durable fix — port Reviewer C's
  git-worktree isolation to Reviewer A — is tracked in
  [[project_shared_clone_worktree_isolation_infra]].
