---
title: "Slang autodiff: runtime (non-constant) loop induction start crashes bwd_diff — cross-scope dangling counterOffset"
type: learning
topic: slang-compiler
source: learnings/1783875005308-slang-autodiff-runtime-non-constant-loop-induction.md
---

# Slang autodiff: runtime (non-constant) loop induction start crashes bwd_diff — cross-scope dangling counterOffset

**Bug (slang#12070, from slangpy#1051):** `bwd_diff` of a `[Differentiable]` fn with a `[MaxIters(N)] for (int dx = <runtime>; ...)` loop whose induction START is a non-constant runtime expr miscompiles. SPIR-V → compile ICE `Unhandled global inst in spirv-emit: neg(<null>)`; CUDA/HLSL → compiles clean but use-before-def → runtime SIGSEGV. Forward pass fine; zero-based rewrite (`for(int t=0;t<2*radius+1;++t){int dx=t-radius;...}`) gives correct gradients.

**The trigger is RUNTIME-NON-CONSTANT start, NOT "negative".** Discrimination matrix (SPIR-V @HEAD 8f0c3515d): const `dx=-2` clean · const `dx=1` clean · runtime `dx=-radius` ICE `neg(<null>)` · runtime `dx=radius;dx>=0` ICE `param`. A peer's "negative start" framing is a symptom; the predicate is `!isIntegerConstantValue(counterOffset)`.

**Root cause (`source/slang/slang-ir-autodiff-primal-hoist.cpp`, codex-confirmed):** Checkpoints are sized/indexed by a SYNTHETIC counter (lowerIndexedRegion :2328), decoupled from `dx` — so it is NOT a checkpoint-OOB bug (corrects the DeepWiki hypothesis). `collectInductionValues` captures `counterOffset = loopInst->getArg(paramIndex)` (:1034) = the loop phi's INITIAL arg, living in the PRIMAL init block. The reverse reconstruction in `applyToInst` builds `dx = diffCountParam*factor + counterOffset` and uses `counterOffset` DIRECTLY (:1355) with NO mapOldValToNew lookup and NO constant-guard. Constant offset = module-global (in scope everywhere → fine); runtime offset = primal-fn inst not live in reverse scope → dangling cross-scope ref → orphan global inst at emit. The induction-special-case path `continue`s at :533-539, skipping the predecessor-arg worklist (:541) that would otherwise clone the offset into reverse. **The tell:** the sibling exit-value path guards `if(!isIntegerConstantValue(counterOffset)) continue;` (:1153); reconstruction has no equivalent.

**Incidental masking:** if the same offset inst is independently pulled into reverse scope by an unrelated recompute use, registerClonedInst remaps it and the bug hides (explains why some runtime-start shapes compile). Not a guaranteed materialization.

**Fix A (root cause, recommended):** materialize the loop-invariant counterOffset in the reverse scope via the existing recompute/clone path before the reconstruction `emitAdd` (use mapOldValToNew if present; first-block params are already function-available). **Fix B (stopgap):** diagnostic-and-bail when offset non-constant — but a bare `continue` is UNSAFE here (reconstruction must set `replacement` or SLANG_ASSERT(replacement) :1364 fires).

**Repro tooling:** slangi interpreter can't run this (`unsupported global inst for vm bytecode emit` / target-switch builtins). Use Debug slangc to `-target spirv` (ICEs early, no downstream needed) and `-target cuda` (compiles → inspect the emitted reverse fn for use-before-def). SPIR-V downstream needs `libslang-glslang-*.so` on LD_LIBRARY_PATH and a real `-o file` (not /dev/null). Set `SLANG_ASSERT=release-assert-only`.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783875005308-slang-autodiff-runtime-non-constant-loop-induction.md`_
