---
title: "slang#12070 autodiff runtime-start induction reconstruction dangles counterOffset"
type: learning
topic: slang-compiler
source: learnings/1783875599862-slang-12070-autodiff-runtime-start-induction-recon.md
---

# slang#12070 autodiff runtime-start induction reconstruction dangles counterOffset

**slang#12070 (autodiff, `bwd_diff` of `[Differentiable]` loop with a runtime induction START).** `bwd_diff` of a `[MaxIters(N)]` loop whose induction start is a runtime expr (`for(int dx=-radius;...)`) ICEs on SPIR-V (`error[E99997] Unhandled global inst in spirv-emit: neg(<null>)`) and use-before-defs on CUDA/HLSL → runtime SIGSEGV. Forward pass fine; zero-based rewrite (`for(t=0;t<2*r+1;++t){int dx=t-r;}`) works.

**Trigger is RUNTIME-start, not NEGATIVE** — constant `dx=-2` compiles clean; `dx=-radius`→ICE `neg(<null>)`; `dx=radius;dx>=0;--dx`→ICE `param`. Verified locally @8f0c3515d.

**Root cause** (`source/slang/slang-ir-autodiff-primal-hoist.cpp`): induction var classified `AffineFunctionOfCounter` captures `counterOffset = loopInst->getArg(paramIndex)` (L1034) = loop phi's initial arg, a PRIMAL-scope inst. Reconstruction path `applyToInst` (L1355-1362) builds `diffCountParam*counterFactor + counterOffset` and passes `counterOffset` DIRECTLY to `emitAdd` with **no constant-guard and no remap through `cloneCtx->cloneEnv.mapOldValToNew`**. Constant offset is module-global (in scope everywhere) → fine; a runtime producer (`neg(radius)`) stays a primal-scope inst referenced from the reverse block → orphan `<null>` operand at SPIR-V emit. The sibling loop-EXIT-value path already guards this (`if(!isIntegerConstantValue(counterOffset)) continue;` L1154, uses `getConstantIntegerValue` L1216); the reconstruction path lacks the equivalent. That asymmetry is the defect.

**Why remap works:** reverse-block insts reach primal values only via `cloneEnv.mapOldValToNew` or after entering `recomputeSet`/`storeSet` (legalized by `ensurePrimalAvailability`, L2563, which runs AFTER `processFunc`@L2558). The INVERSION path already remaps its operands (L1395-1396); reconstruction skips it. counterOffset is loop-invariant (initial arg) → safe to materialize once.

**Fix (recommended, Approach A):** materialize/remap the loop-invariant `counterOffset` into the reverse scope before `emitAdd`, preserving the constant fast path. A2 = add offset producer to recompute set + remap (reuses ensurePrimalAvailability); A1 = clone-at-use via `cloneInstOutOfOrder` / mapOldValToNew lookup. Do NOT use a bare `continue` here — L1364 `SLANG_ASSERT(replacement)` fires. Fixes SPIR-V ICE + CUDA use-before-def together.

**GPU-free test:** precedent tests/autodiff/loop-init.slang (`COMPARE_COMPUTE_EX -cpu`). Add runtime-start-vs-zero-based `-cpu` gradient comparison, and/or a `-target spirv` compile-must-not-ICE SIMPLE test. Regression guard: tests/autodiff/reverse-while-loop*.slang, long-loop-*.slang.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783875599862-slang-12070-autodiff-runtime-start-induction-recon.md`_
