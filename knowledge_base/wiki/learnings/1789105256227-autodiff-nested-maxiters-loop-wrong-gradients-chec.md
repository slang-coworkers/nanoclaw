---
title: "Autodiff nested [MaxIters] loop wrong gradients — checkpoint array dim/index transposition (slang#13000)"
type: learning
topic: slang-compiler
source: learnings/1789105256227-autodiff-nested-maxiters-loop-wrong-gradients-chec.md
---

# Autodiff nested [MaxIters] loop wrong gradients — checkpoint array dim/index transposition (slang#13000)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789103346690-2g29w7
written_at: 2026-09-11T05:40:56.227Z
---

# Autodiff nested [MaxIters] loop wrong gradients — checkpoint array dim/index transposition (slang#13000)

**Symptom:** `bwd_diff` through two NESTED non-unrolled `[MaxIters]` loops gives WRONG *input* gradients (dx) — silently wrong on Vulkan/CPU, `CUDA_ERROR_ILLEGAL_ADDRESS` (OOB) on CUDA. `[ForceUnroll]` or equal loop bounds are correct. Forward values + the loop body's own weight/bias grads are correct; only the gradient passed back to the input is wrong. Fires iff the two loops' `[MaxIters]` bounds differ by ≥3; corrupted element is always the highest inner-loop index. Long-standing (not a regression), reproduces across many Slang versions.

**Root cause (dual independent code-trace + empirically reproduced on CPU top-of-tree):** in `source/slang/slang-ir-autodiff-primal-hoist.cpp`, the reverse-mode per-iteration checkpoint array for nested loops is **built innermost-first** (`getTypeForLocalStorage`, ~:1572-1588, each dimension sized `IndexTrackingInfo::maxIters + 1`, folded with `getArrayType` which wraps a NEW OUTER dim each step) but the store/load addressing **peels outermost-first** (`emitIndexedStoreAddressForVar`/`emitIndexedLoadAddressForVar`, ~:1617-1672, via `emitElementAddress`). `defBlockIndices` comes from `getAllAncestorRegions` (`slang-ir-autodiff-region.h:74-83`) INNERMOST-first. Net: the outermost array dim (sized by the OUTER loop's bound) gets indexed by the INNER loop's counter, and vice versa — each nested loop's saved state is effectively sized from the SIBLING loop's `[MaxIters]`. inner_max>outer_max → OOB; outer_max>inner_max → slot aliasing → wrong dx; equal bounds symmetric → correct.

**Fix direction:** make allocation order and indexing order agree. Minimal single-site fix: reverse the fold order in `getTypeForLocalStorage` so dimension i (capacity `defBlockIndices[i].maxIters+1`) is indexed by `defBlockIndices[i]`'s counter (store/load unchanged, stay mutually consistent; no-op for single-loop / equal-bound cases). Equivalent alt: reverse the peel in BOTH emit*AddressForVar.

**Repro trap that cost real time — the trigger needs a CHECKPOINTED per-iteration primal, not just nested [MaxIters]:**
- Inline-constant weight (recomputable from loop indices) → recomputed in reverse, NO checkpoint array is created → the bug does NOT fire even with nested `[MaxIters]`.
- Weight read from a plain `StructuredBuffer` via a `no_diff` accessor, or via a custom `[BackwardDerivativeOf]` accessor → dx is ALL ZEROS even under `[ForceUnroll]` (the buffer load carries zero differential), so it can't demonstrate this bug.
- Working construction: pass the weight matrix as a **differentiable input array** read through a `[Differentiable]` helper; check `dpx.d` (input differential), not the weight grad. Reproduces GPU-free on `-cpu` COMPARE_COMPUTE. `slangi` interpreter can't run it (`unimplemented: VM bytecode gen for inst`).

This is a target-independent reverse-mode IR-pass bug — always reproducible on `-cpu`, no GPU needed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789105256227-autodiff-nested-maxiters-loop-wrong-gradients-chec.md`_
