---
type: triage
title: "Triage: shader-slang/slang#14345 — Metal groupshared load in a helper sunk past GroupMemoryBarrierWithGroupSync"
---
# Triage: shader-slang/slang#14345 — Metal: groupshared load before a barrier emitted after it
Date: 2026-11-05 | bug | high | P2 | IR (side-effect analysis; shows on Metal) | Duplicate: same root as #13409 (helper/kernel-context variant), fixed by draft PR #13421 (and by #13431)

## What's broken
In a non-entry-point function on Metal, `float total = sh[0]; GroupMemoryBarrierWithGroupSync(); return total;`
emits `threadgroup_barrier(...); return (*_S2)[int(0)];`. The load is moved after the barrier, so it races with the next call's writes.
Reporter albertrodriguezclo (CONTRIBUTOR, external) hit this on an Apple M4 in a CG solver.

## Repro (GPU-free)
`slangc repro.slang -target metal -entry main -stage compute [-O0]`. The issue body has the repro (groupSum called twice).
- master 04d2726db (v2026.21-15; Debug rebuilt at HEAD, ninja no-op): BUG at -O0 and at the default level.
- 2026.13.1 release tarball: BUG, so long-standing, not a regression.
- CUDA/WGSL/HLSL/GLSL/SPIR-V: correct (load before the barrier).

## Codebase digest
- The final `-dump-ir` (after checkUnsupportedInst) is CORRECT: `%45=load(%23 kernelContext->sh)`, `%46=gep(%45,0)`, `%total=load(%46)`, barrier, `return_val(%total)`.
- `simplifyForEmit` runs after that, at slang-emit.cpp:3131, and is not shown in the dump. `processLoadUse` (slang-ir-simplify-for-emit.cpp:127) re-emits the load before its use if `canInstHaveSideEffectAtAddress` is false for every instruction in between.
- The kIROp_Call arm (slang-ir-util.cpp:1643) skips the conservative check when `getRootAddr(addr)` is a child of the function. Here the root is the pointer `load(kernelContext->sh)`, which is in the function. The barrier has no args, so the arm returns false and the load sinks. The emitter then folds the single-use load into the return.
- The emitter fold (slang-emit-c-like.cpp:1893) is NOT the cause: `mightHaveSideEffects(barrier call)` is true, so the fold stops at the barrier.
- Ptr type address space 3 = AddressSpace::GroupShared (slang-type-system-shared.h:120).
- CPU also uses the kernel context, but the barrier is unavailable there (E36107). Others keep `sh` global, which takes the conservative path.

## PR heads tested (built 2026-11-05 in wt-14345-pr13421 / wt-14345-pr13431)
- #13421 @c42049e18f: FIXED at -O0 and the default level (`float total_0 = (*kernelContext_0->sh_0)[int(0)]; barrier; return total_0;`).
- Revert drill: removing #13421's 2-line check `isGroupSharedAddr(rootAddr) && isChildInstOf(rootAddr, func) → true` (ir-util.cpp:1455) brings the bug back. This proves that change does the fix and that base v2026.19-25 has the bug.
- #13431 @56c820f80e: FIXED. Its output is byte-identical to #13421's (the pointer root is not "caller-private" in `isCallerPrivateRoot`).
- Both PRs are based on 6ba151dcfc (v2026.19-25), 195 commits behind master. Master's MSL hoists `_S1 = kernelContext_0->sh_0`, but the root shape is the same.
- #13421's HELPER FileCheck already covers the kernel-context pointer root. That test uses load → barrier → store, not this load → barrier → return_val shape.

## Candidate approaches
### A: Fold into #13409 / PR #13421 (recommended)
- Where: slang-ir-util.cpp Call arm (the #13421 hunk). Optionally add this issue's load → barrier → return shape to tests/metal/groupshared-barrier-ordering.slang.
- Delta: none beyond #13421. Risk: none new.
### B: Rely on #13431's broader rule (pointer roots are never caller-private)
- Also fixes this repro. It is broader (all targets) and has a larger blast radius. Whichever PR merges second rebases.
### C (rejected): Block the fold in the emitter
- That is a symptom-level change: the emitter is correct. The bad move happens in IR `simplifyForEmit`.

## Recommended path
No new fixer chain. #14345 is the helper-function (kernel-context pointer) shape of #13409. Draft PR #13421 fixes it (verified, with a revert drill), and #13431 does too.
Optional follow-up for the #13421 owner: add the #14345 shape as a regression check (HELPER2: load → barrier → return).
Acceptance: the repro emits the load of `sh[0]` before `threadgroup_barrier` at -O0 and at the default level.

## Sources
- DeepWiki: introduceExplicitGlobalContext stores groupshared as entry-point locals in the GroupShared address space, reached via a KernelContext field. processLoadUse / canInstHaveSideEffectAtAddress Call-arm local-root limitation.
- Shared learning: /workspace/shared/wiki/learnings/1790967869022-metal-cpu-groupshared-is-a-function-local-var-afte.md
- Related: #13409 (PR #13421), #13412 (PR #13431), #13465, #13466, #13273 (emitter fold transitivity, closed).
