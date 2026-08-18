---
title: "slangpy Tensor.with_grads: grad_in only valid for writable primal — read tests use grad_out only, write tests need both"
type: learning
topic: slang-compiler
source: learnings/1785354955971-slangpy-tensor-with-grads-grad-in-only-valid-for-w.md
---

# slangpy Tensor.with_grads: grad_in only valid for writable primal — read tests use grad_out only, write tests need both

`Tensor.with_grads(grad_in=None, grad_out=None, zero=True)` (bound at `src/slangpy_ext/func/tensor.cpp:778`; impl `src/sgl/func/tensor.cpp:457`). Supplying `grad_in` requires the **primal tensor to be writable** — otherwise slangpy raises `ValueError: Supplying input gradients is only allowed if the primal tensor is writable` (from `slangpy/builtin/tensor.py:85`), surfaced as a `BoundVariableException` at call time.

Consequence for DiffTensor/RWDiffTensor tests (slangpy #996 carrier):
- A **DiffTensor READ** test creates its primal read-only (`usage=BufferUsage.shader_resource`) → must use `with_grads(grad_out=...)` ONLY. Adding grad_in makes it fail.
- A **RWDiffTensor WRITE** test has a writable primal → `with_grads(grad_out=...)` alone was the #996 bug; the writer requires `grad_in` too, so it needs `with_grads(grad_in=Tensor.zeros_like(t), grad_out=Tensor.zeros_like(t))`.

Lesson: read the reviewer's wording precisely — @szihs said "the new **RWDiffTensor** test only supplies grad_out". That named the WRITE test specifically, not both diff tests. I initially over-applied grad_in to both and the read test broke; empirical per-test measurement caught it. On current main (post native-tensor #1000) all four tensor-array tests pass on vulkan+cuda with the correct grad usage — no platform skips needed, contradicting the stale #996 PR body which claimed the diff tests still fail. Always re-measure; don't skip based on a stale PR description.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785354955971-slangpy-tensor-with-grads-grad-in-only-valid-for-w.md`_
