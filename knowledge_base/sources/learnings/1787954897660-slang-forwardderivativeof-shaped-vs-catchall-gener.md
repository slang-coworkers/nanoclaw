---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787953907641-exg5rv
written_at: 2026-08-28T22:08:17.660Z
---

# slang [ForwardDerivativeOf] shaped-vs-catchall generic overload E31148 (two coupled gaps)

A `[ForwardDerivativeOf(f)]` (or `[BackwardDerivativeOf]`) whose derivative has a *shaped* generic signature (e.g. `__generic<T:__BuiltinFloatingPointType, let N:int>` over `vector<T,N>`) fails with `error[E31148]: cannot resolve derivative function` when the primal name `f` also has a *catch-all* generic overload (`f<T:IFloat>(T)`) that is ALSO applicable to the derivative's imaginary args. Confirmed 2026-08-28 on shader-slang/slang#12825 (ToT Release 2026.13.1-50-g3649fb982, CPU/frontend — no GPU). Second independent sighting of the mechanism first recorded from #12591 (`slang-free-function-forwarder-over-a-new-interface`).

This is TWO coupled gaps, not one:
1. **Unimplemented constrained-subset derivative binding.** `checkDerivativeOfAttributeImpl` (source/slang/slang-check-decl.cpp:18992) cannot bind a derivative whose generic signature is a *constrained subset* of a catch-all primal's (`<T, let N>` shape `vector<T,N>` vs primal `<T>`). The code names this deferred capability itself at :19082-19087 ("...must be the same generic decl ... relax in future by solving the 'inverse' generic arguments"). This is exactly the #6486 constrained-override goal, still unimplemented — so the catch-all-ONLY config also fails E31148.
2. **Overload tie blind to constraint tightness.** With both overloads present, derivative resolution routes through ordinary overload resolution over imaginary args. `compareOverloadCandidateSpecificity` prefers more generic params but ignores constraint tightness (explicit TODO slang-check-overload.cpp:2201), and `CompareOverloadCandidates` early-returns a tie whenever either candidate flavor is `Generic`/`UnspecializedGeneric` (:2420) BEFORE scope/overload rank. So the two overloads tie / attach to the catch-all, then gap (1) makes the synthesized reverse rebind fail → E31148 raised at slang-check-decl.cpp:18480/:18512 (the caret lands on the `[ForwardDerivativeOf]` line because the synthesized `[ForwardDerivative]` attr copies the DerivativeOf attr's loc).

**Decisive probe** (use this to distinguish gap (2) from a plain typo): narrow the catch-all's constraint so it is NOT applicable to `vector<T,N>` — e.g. change `<T:IFloat>` to `<T:__BuiltinFloatingPointType>` (scalars conform, vectors don't). The both-overloads config then compiles clean. Note `float3` DOES conform to `IFloat`, which is why the two compete in the original repro.

**Core-module impact:** adding a public generic wrapper like `sin<T:IReal>(T)` beside the existing scalar/vector/matrix `sin` (hlsl.meta.slang:15012/15032/15052) breaks the generated shaped `[ForwardDerivativeOf(sin)]` declarations in diff.meta.slang (~:1851-1917, :2105) at builtin-module load. Workaround = rename shaped builtins to private names and route the public surface through the wrapper.

**Fix directions:** (B, principled) implement inverse generic-argument solving at slang-check-decl.cpp:19082; (A, interim) signature-directed overload selection at :19025-19045 reusing `doGenericSignaturesMatch` (:12909) — but A alone does NOT fix the catch-all-only case; (C, always) make the diagnostic name the ambiguity + candidate list instead of a bare "cannot resolve". Design-gated: which semantics is intended is a maintainer call.
