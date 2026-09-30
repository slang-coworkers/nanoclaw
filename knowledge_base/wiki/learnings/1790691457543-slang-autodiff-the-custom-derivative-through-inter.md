---
title: "Slang autodiff: the custom-derivative-through-interface bug (#13301) persists for *DerivativeOf and [Differentiable][PrimalSubstitute]. Two pre-existing higher-order segfaults"
type: learning
topic: slang-compiler
source: learnings/1790691457543-slang-autodiff-the-custom-derivative-through-inter.md
---

# Slang autodiff: the custom-derivative-through-interface bug (#13301) persists for *DerivativeOf and [Differentiable][PrimalSubstitute]. Two pre-existing higher-order segfaults

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790689201163-c6ztdm
written_at: 2026-09-29T14:17:37.543Z
---

# Slang autodiff: the custom-derivative-through-interface bug (#13301) persists for *DerivativeOf and [Differentiable][PrimalSubstitute]. Two pre-existing higher-order segfaults

The #13301 fix (fix-13301.patch) makes `checkDifferentiableCallableCommon` skip the default IForward/IBackwardDifferentiable conformance when the decl carries `[ForwardDerivative]` or `[BackwardDerivative]`. That fixes existential, generic and dynamic calls for the attribute-on-primal spelling. Probes (CPU, 2026-09-29, master 4fe660083) show two spellings that still silently use the auto-derivative through an existential; concrete calls are correct in both:
- `[Differentiable] read` + `[BackwardDerivativeOf(read)] read_bwd`: existential gives 3, expected 10. The DerivativeOf path never adds the attribute to the primal's modifiers.
- `[Differentiable][PrimalSubstitute(g)] read`, where `g` is `[Differentiable][BackwardDerivative]`: existential gives 3. A plain `[PrimalSubstitute(g)] read` without `[Differentiable]` is correct (10/10).

Two segfaults exist on master (slangc rc 139), independent of that patch:
- `fwd_diff(fwd_diff(f))`, where `f` is a member `[ForwardDerivative(read_fwd)][Differentiable]` method and `read_fwd` is not `[Differentiable]`. The free-function version gives E30027 instead.
- `bwd_diff(fwd_diff(f))` with a differentiable custom fwd on a member method.

Probe-harness tip: `slang-test` writes `<test>.actual.txt` next to a failing COMPARE_COMPUTE test. Use a deliberately failing `// CHECK: SHOW_ME` to dump the whole output buffer.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790691457543-slang-autodiff-the-custom-derivative-through-inter.md`_
