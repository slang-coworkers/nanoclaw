---
title: "slangpy 0.41 Tensor API migration — official guide + the real store-vs-add rule"
type: learning
topic: slang-compiler
source: learnings/1781603359888-slangpy-0-41-tensor-api-migration-official-guide-t.md
---

# slangpy 0.41 Tensor API migration — official guide + the real store-vs-add rule

When slangpy-samples (or any slangpy shader code) "breaks on the newest slangpy", the root cause is usually the **SlangPy 0.41 Tensor API rewrite**, and slangpy ships the authoritative recipe: **`slangpy/docs/tensorupdate.rst` ("Migration guide for Tensor update")**. Read it FIRST — it lists the exact renames and the correct ordering (types before accessors).

The migration has FOUR breakage classes, not just getv/setv:
1. **Accessors**: `.get(`/`.set(`/`.getv(`/`.setv(` → `.load(`/`.store(` (uniform per the guide).
2. **Differentiable type renames**: `GradInTensor→WDiffTensor`, `GradOutTensor→DiffTensor`, `GradInOutTensor→RWDiffTensor` (interface forms `IWDiffTensor`/`IDiffTensor`/`IRWDiffTensor` for params). The old `Grad*Tensor` names are REMOVED — code using them fails on type resolution, a separate symptom from getv/setv.
3. **NDBuffer removal**: `NDBuffer`/`RWNDBuffer` removed from the Slang API → `Tensor`/`RWTensor` (or `ITensor`/`IRWTensor` for params). Python `NDBuffer` deprecated.
4. Old field accessors `.d_out`→`_grad_out`, `.primal`→`_primal` on the new diff types.

**The store-vs-add rule (the key correctness nuance):** the guide says accessors map UNIFORMLY to load/store — `add` is NOT an accessor-rename target. `add` exists ONLY on `AtomicTensor<T: IAtomicAddable, D>` (tensor.slang `atomicAddWithStride`), NOT on RWTensor/WTensor. When you use the differentiable tensor TYPES (DiffTensor/RWDiffTensor) and let autodiff generate the backward, gradient accumulation is automatic (the type's backward calls `_grad_out.add` internally) — user code just calls load/store. You only write `.add()` manually at sites where a sample **hand-writes a backward derivative** (`[BackwardDerivativeOf]`/`[BackwardDerivative]`) that scatters gradients into an `AtomicTensor`/`_grad_out`. There, `set→add` (store would let the last writer win and silently drop gradients). Conversely, forward-output writes and RMW transforms like `grad.setv(p, grad.getv(p)/N)` (a division/average) must stay `store` — a blind `setv→add` corrupts them. So: audit each WRITE by (a) target tensor type and (b) forward-output vs hand-written-backward-scatter.

Reference migration PR for the add-site pattern: shader-slang/neural-shading-s25#10. Context: investigated for slangpy-samples#43 (2026-06-16).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781603359888-slangpy-0-41-tensor-api-migration-official-guide-t.md`_
