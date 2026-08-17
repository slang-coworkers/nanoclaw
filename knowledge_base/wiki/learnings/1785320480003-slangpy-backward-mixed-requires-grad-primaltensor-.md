---
title: "SlangPy backward mixed requires_grad — PrimalTensor is the zero-alloc fix, not a scratch grad buffer"
type: learning
topic: slang-compiler
source: learnings/1785320480003-slangpy-backward-mixed-requires-grad-primaltensor-.md
---

# SlangPy backward mixed requires_grad — PrimalTensor is the zero-alloc fix, not a scratch grad buffer

**Context:** slangpy#1056/#1057 — a `[Differentiable]` function with multiple `IDiffTensor` inputs aborts (`CUDA_ERROR_ILLEGAL_ADDRESS`) in backward when only *some* inputs have `requires_grad=True`.

**Root cause (verified in source):**
- A no-grad `IDiffTensor` input still binds as `DiffTensor` in backward because the `DiffTensor`-vs-`PrimalTensor` choice is made by **call mode**, not per-tensor `requires_grad` (`slangpy/builtin/tensorcommon.py`, ~line 169).
- `DiffTensor`'s kernel scatters `_grad_out` unconditionally (`slangpy/slang/difftensor.slang` → `AtomicTensor.add` → `atomics.slang`).
- On **CUDA** the atomic buffer type is a raw `T*` (`atomics.slang:107`), so an unbound grad buffer = dangling pointer = fault. On **non-CUDA** it fails earlier: type resolution rejects a diff tensor with no output gradient at kernel-gen (`tensorcommon.py`, `has_grad_out and d_out is None`). **Two distinct failure modes** — a CUDA null-guard alone doesn't fix non-CUDA.

**The clean fix (no allocation):** bind the no-grad input as `PrimalTensor`, which conforms to `IDiffTensor`, carries **no** `_grad_out`, and compiles `_write_grad_each`/`_accumulate_grad_each` to no-ops (`slangpy/slang/primaltensor.slang:50-55, 218`). Purpose-built for "an IDiffTensor where gradients aren't needed."

**Why it's not trivial:** the torch tensor kernel signature is `[Dn,Sm]` (ndim + scalar type only) — it does NOT encode `requires_grad` (`bridge_fallback.py` get_signature, `torch_bridge_impl.cpp:120`). So mixed-grad and all-grad calls hash to the same backward kernel. Doing PrimalTensor properly means threading `requires_grad` into type resolution AND the signature so the backward kernel specializes per grad-config.

**Takeaway:** the quick fix (bind a throwaway zeroed buffer in `autograd_backward`, slangpy.cpp:~584) works but wastes one primal-sized buffer per frozen input every backward. Maintainer (ccummingsNV) correctly flagged it as overkill. PrimalTensor is the correct fix.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785320480003-slangpy-backward-mixed-requires-grad-primaltensor-.md`_
