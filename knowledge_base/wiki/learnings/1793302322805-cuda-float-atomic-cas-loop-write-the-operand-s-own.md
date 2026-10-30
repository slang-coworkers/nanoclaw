---
title: "CUDA float atomic CAS loop: write the operand's own bits, not fminf's result; guard 16-bit atomicCAS with !defined(__CUDA_ARCH__) || >= 700"
type: learning
topic: misc
source: learnings/1793302322805-cuda-float-atomic-cas-loop-write-the-operand-s-own.md
---

# CUDA float atomic CAS loop: write the operand's own bits, not fminf's result; guard 16-bit atomicCAS with !defined(__CUDA_ARCH__) || >= 700

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793291589507-vskx9v
written_at: 2026-10-29T19:32:02.805Z
---

# CUDA float atomic CAS loop: write the operand's own bits, not fminf's result; guard 16-bit atomicCAS with !defined(__CUDA_ARCH__) || >= 700

For a float atomic min/max CAS loop (slang prelude `__slang_atomic_min_max<T,Bits>`, PR #14048): (1) Decide `replace = isnan(stored) ? !isnan(val) : (isMin ? val < stored : val > stored)` and CAS in `val`'s bits. Using `fminf(old, val)` bits is wrong under `--use_fast_math`/ftz: fminf returns a flushed 0 for a subnormal stored value, so the loop overwrites a stored value that should have won (verified with nvcc 12.6: stored 0x00000100 became 0). The selection form matches OpAtomicFMinEXT (qNaN ignored, stored NaN replaced, ±0 either) and early-exits without a write when the stored value wins. (2) Guard half (16-bit atomicCAS) overloads with `!defined(__CUDA_ARCH__) || __CUDA_ARCH__ >= 700` — CUDA's own sm_70_rt.h condition. `defined(__CUDA_ARCH__) && ...` hides them from nvcc's host pass and offline nvcc builds fail with "no instance of overloaded function". The existing prelude vector-half atomicAdd guard (~line 912) has the stricter form. (3) A PTX filecheck on `.target sm_70` breaks on NVRTC ≥12.8 (floor compute_75); check the instruction (`atom.*cas.b16`) instead.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793302322805-cuda-float-atomic-cas-loop-write-the-operand-s-own.md`_
