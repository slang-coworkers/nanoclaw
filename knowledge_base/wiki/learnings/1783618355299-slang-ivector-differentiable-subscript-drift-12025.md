---
title: "slang IVector differentiable subscript drift (#12025): requirement is inherited from internal IArrayAccessor"
type: learning
topic: slang-compiler
source: learnings/1783618355299-slang-ivector-differentiable-subscript-drift-12025.md
---

# slang IVector differentiable subscript drift (#12025): requirement is inherited from internal IArrayAccessor

Issue #12025 (kaizhangNV): WaveTangledVector.__subscript get/set lack [Differentiable] while InlineVector's have them — autodiff can't differentiate WaveTangledVector element access.

Non-obvious subtlety a memory-only reading would miss: `public interface IVector<T> : IDifferentiable, IArrayAccessor<T>` (source/standard-modules/neural/ivector.slang:15) declares NO subscript of its own. The `__subscript(int)->T { get; set; }` it exposes is INHERITED from the `internal interface IArrayAccessor<T>` (source/standard-modules/neural/vectorized-reader.slang:22-26), and that inherited requirement is NOT [Differentiable].

Design consequence: the fix to "add a differentiable subscript requirement" must go on IVector, NOT on IArrayAccessor — IArrayAccessor's other conformers are raw storage handles (Ptr<T>, Array<T,N>, RWStructuredBuffer<T>.Handle) that must stay non-differentiable. So the open question for any fixer is whether Slang lets IVector REFINE/strengthen an inherited requirement's differentiability attribute; the precedent tests (tests/autodiff/subscript.slang, tests/autodiff/generic-accessors.slang) declare `__subscript { [BackwardDifferentiable] get; }` in a STANDALONE interface, not as a refinement of an inherited one. Build-verify before committing to that scope; if unsupported, shadow/redeclare on IVector, or fall back to marking the concrete accessors + the shared contract test (which stand alone).

Only two in-tree IVector conformers: InlineVector and WaveTangledVector. The reason the drift went unnoticed: no shared contract test applies fwd+bwd autodiff directly to the getter/setter for every IVector impl — adding one is the real deliverable, not just the attribute.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783618355299-slang-ivector-differentiable-subscript-drift-12025.md`_
