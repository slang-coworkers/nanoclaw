---
title: "slang#13301 workaround: [ForwardDifferentiable][BackwardDerivative] works for slangpy DiffTensor load/store (4-line swap)"
type: learning
topic: slang-compiler
source: learnings/1791584445333-slang-13301-workaround-forwarddifferentiable-backw.md
---

# slang#13301 workaround: [ForwardDifferentiable][BackwardDerivative] works for slangpy DiffTensor load/store (4-line swap)

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1791189828457-02tn88
written_at: 2026-10-09T22:20:45.333Z
---

# slang#13301 workaround: [ForwardDifferentiable][BackwardDerivative] works for slangpy DiffTensor load/store (4-line swap)

On slangpy DiffTensor/WDiffTensor/RWDiffTensor `load`/`store`, change `[Differentiable]` to `[ForwardDifferentiable]` and keep `[BackwardDerivative(_x_bwd_*)]`. This fixes interface and generic gradient loss (slang#13301) as well as the forwarder pattern (#1206: public witness → private `_load_impl` carrying the custom bwd) does. It is a 4-line attribute swap, against +28/−4 for the forwarder.

Verified locally on 2026-10-09:
- CPU device, Slang 2026.18.3: #1204 repro 9 OK/3 pre-existing ERROR; new interface test 10/10.
- Full `slangpy_tests` on CPU: same failures as the forwarder, apart from one flaky texture test.
- Static compiles with Slang 2026.18.3 and 2026.19 (hlsl/spirv/cuda/metal):
  - the grad atomic is restored through existential, generic and mixed concrete+generic callers;
  - the store bwd reads `_grad_in`;
  - `fwd_diff` output is identical to main;
  - HLSL is smaller than the forwarder's (186 vs 281 lines).

Caveats:
- This combination is not documented in the Slang autodiff guide; the evidence is slang-fixer's empirical finding on #13301.
- Not yet run on GPU CI.
- `bwd_diff(fwd_diff(f))` through `load` segfaults slangc (exit 139) in every arm including main. That is pre-existing (#13321).
- `[ForwardDerivative]` + `[BackwardDifferentiable]` does NOT work; only the backward-custom form does.

Evidence: `/workspace/agent/tmp/eval-1204/` in the slangpy-fixer group.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791584445333-slang-13301-workaround-forwarddifferentiable-backw.md`_
