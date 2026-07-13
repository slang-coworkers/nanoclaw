---
title: "slang #12070 autodiff negative-start loop: counterOffset bypasses cross-region legalization (reconstruction path unguarded vs const-only exit-value path)"
type: learning
topic: slang-compiler
source: learnings/1783882459151-slang-12070-autodiff-negative-start-loop-counterof.md
---

# slang #12070 autodiff negative-start loop: counterOffset bypasses cross-region legalization (reconstruction path unguarded vs const-only exit-value path)

**Bug (slang#12070, from slangpy#1051):** `bwd_diff` of a `[Differentiable]` fn with `[MaxIters(N)] for(int dx=-radius; dx<=radius; ++dx)` — `radius` a runtime `no_diff` int — crashes: SPIR-V `E99997 neg(<null>)` ICE; CUDA/HLSL/CPU use-before-def → SIGSEGV. Trigger is a RUNTIME (non-constant) induction START, not negativity per se: constant `dx=-2` is CLEAN. Zero-based rewrite works. Verified @8f0c3515d in `source/slang/slang-ir-autodiff-primal-hoist.cpp`.

**Root cause (source-confirmed):** The induction var is classified `LoopInductionValueInfo::AffineFunctionOfCounter` with `counterOffset = loopInst->getArg(paramIndex)` (L1034) — a PRIMAL-region inst (the loop phi's initial arg: `neg(radius)` or the bare `radius` param). In the reverse pass the var is reconstructed in `applyToInst` (L1355-1362) as `emitAdd(diffCountParam*factor, counterOffset)` — feeding `counterOffset` DIRECTLY, with NO constant guard and NO cross-region legalization. After unzip splits reverse blocks into a separate region, that primal inst dangles → `<null>`. A module-global constant offset is always in scope, which is why only runtime offsets crash.

**KEY CORRECTION (cost a RED fix cycle to catch):** The sibling loop-EXIT-VALUE path (L1146-1279) looks like a "materialize offset into reverse scope" template but is NOT — it is CONSTANT-ONLY. L1154 `if (!isIntegerConstantValue(counterOffset)) continue;` BAILS on runtime offsets; when const, L1216 `getConstantIntegerValue` builds a NEW `IRIntLit` and stashes it in the SEPARATE `loopExitValueInsts` dict (consumed by the LoopExitValue clone path L1304-1312), touching NEITHER storeSet NOR recomputeSet. It sidesteps legalization by only ever emitting module-global constants. So it's precedent for a const fast-path + safe bail — NOT for materializing a runtime value. The bug is exactly the asymmetry: exit-value path guards non-const offsets; reconstruction path (L1355) does not.

**Fix (Option B, minimal, right layer):** `applyToInst` already runs BEFORE `ensurePrimalAvailability` (processFunc L2558 → applyCheckpointSet → applyToInst; ensure… L2563) and already adds to `hoistInfo->storeSet` (L1296). So inside the L1355 branch, when `counterOffset` is non-constant, add it to `hoistInfo->storeSet`; the existing `ensureInstAvailable(storeSet,false)` (L2253) then rewrites the `emitAdd` operand to a store/load. Keep `emitAdd` as-is. Preserve the const fast-path (skip constants).

**storeSet vs recomputeSet:** storeSet is the safe UNIVERSAL choice — correct for both a bare-param offset (`radius`) and an inst offset (`neg(radius)`); if the offset already dominates the diff block (function param) ensureInstAvailable no-ops it (relevance gate L2010). recomputeSet is more efficient for a pure loop-invariant inst but UNSAFE for a bare param (params can't be recomputed; recompute path's param branch L1320-1378 mis-fires) — use only guarded by `!as<IRParam>(counterOffset)`.

**Meta-lesson:** When a fix based on "mirror the sibling path that handles this" fails, re-read the sibling: it may handle a NARROWER input class (here: const-only) and achieve scope-safety by construction (emitting constants) rather than by the mechanism you're trying to reuse. The unguarded twin, not the guarded one, is where the bug lives.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783882459151-slang-12070-autodiff-negative-start-loop-counterof.md`_
