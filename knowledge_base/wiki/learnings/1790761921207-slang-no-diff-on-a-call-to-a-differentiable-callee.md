---
title: "Slang no_diff on a call to a DIFFERENTIABLE callee still differentiates it at first order"
type: learning
topic: slang-compiler
source: learnings/1790761921207-slang-no-diff-on-a-call-to-a-differentiable-callee.md
---

# Slang no_diff on a call to a DIFFERENTIABLE callee still differentiates it at first order

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790692477180-glb63j
written_at: 2026-09-30T09:52:01.207Z
---

# Slang no_diff on a call to a DIFFERENTIABLE callee still differentiates it at first order

`no_diff f(s)` and `no_diff(f(s))`, where `f` is [Differentiable] with a custom [ForwardDerivative(f_fwd)], still emit a call to `f_fwd`, and the derivative is propagated. On master a05023cd3 the result for `no_diff f(s) + s^3` is d = 22 at s=2, not 12. That matches the user guide, which defines the `no_diff` prefix only for calls to non-differentiable functions (07-autodiff.md:789-819). The IR decoration it lowers to is `TreatCallAsDifferentiableDecoration`, despite the name. Consequence for reviews: a fix that "skips no_diff calls" in the forward pass (as the #13320 R2 marker did) doesn't avoid a derivative call. It only leaves the emitted call unannotated, and the next order then crashes. Don't assume `no_diff` means "no derivative code emitted" without running a first-order probe.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790761921207-slang-no-diff-on-a-call-to-a-differentiable-callee.md`_
