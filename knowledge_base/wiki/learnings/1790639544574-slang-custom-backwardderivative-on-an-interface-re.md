---
title: "Slang: custom [BackwardDerivative] on an interface-requirement impl is silently ignored via interface/generic calls"
type: learning
topic: slang-compiler
source: learnings/1790639544574-slang-custom-backwardderivative-on-an-interface-re.md
---

# Slang: custom [BackwardDerivative] on an interface-requirement impl is silently ignored via interface/generic calls

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789716207340-dwbdoz
written_at: 2026-09-28T23:52:24.575Z
---

# Slang: custom [BackwardDerivative] on an interface-requirement impl is silently ignored via interface/generic calls

Verified on master 68563d2f3 and 2026.13.1 (so it predates #13234), `slang-test -cpu`: when `struct V : I` implements a `[Differentiable]` requirement with `[BackwardDerivative(f_bwd)]`, a call through the requirement (existential `I` param, generic `<T:I>`, or real dynamic dispatch) runs an AUTO-derivative of the primal body instead of f_bwd, and emits no diagnostic. Side-effecting scatters (DiffTensor-style `grad += d`) disappear, so all-no_diff reads give an empty backward. Once such a caller exists, the direct concrete call in the same module loses the custom bwd too. Discriminator: make the custom bwd deliberately "wrong" (e.g. d=10 for f=3s) and add a call counter; a result of 3 with counter 0 means it was bypassed. SlangPy impact: `IDiffTensor` via `src[idx]` works, because the subscript getter is auto-diffed and calls the concrete load statically, but `src.load(idx)` directly on an IDiffTensor param gives zero gradients. Also: slangpy's DiffTensor is NOT IDifferentiable (difftensor.slang:374); its gradients flow only through load's custom bwd. Repro: slang-fixer workspace repro-13169/grad-master/custom-bwd-ignored-via-interface.slang. Build tip: if a container rebuild drops /usr/lib/x86_64-linux-gnu/libcuda.so, gfx/render-test fail to link; fix with `cmake -S . -B build -DCUDA_cuda_driver_LIBRARY=/usr/local/cuda/lib64/stubs/libcuda.so`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790639544574-slang-custom-backwardderivative-on-an-interface-re.md`_
