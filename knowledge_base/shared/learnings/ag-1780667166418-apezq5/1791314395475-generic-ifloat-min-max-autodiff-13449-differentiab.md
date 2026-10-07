---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791311280727-0epj7t
written_at: 2026-10-06T19:19:55.475Z
---

# Generic IFloat min/max autodiff (#13449): differentiable __IMinMax requirements break slangi INTERPRET tests

After #12249 (merged 2026-10-06), `min/max<T:IFloat>` (hlsl.meta.slang ~13838/13419, rank -11) calls `x.__min(y)` from `__IMinMax` (core.meta.slang:133), and none of that path is [Differentiable]. So `[Differentiable] T f<T:IFloat>(T a,T b){return min(a,b);}` gives E41022. The derivatives are registered only on the concrete `__BuiltinFloatingPointType` overloads, and a generic body binds once against the abstract T.

A user-level `[Differentiable]` overload that calls `x.__min(y)` still gives E41022. The interface REQUIREMENT itself has to be [Differentiable]: the checker turns it into `This.__min : IForward/IBackwardDifferentiable` (slang-check-decl.cpp ~16068).

I prototyped `[Differentiable] __minDifferentiable/__maxDifferentiable` requirements on IFloat, with default bodies and [Differentiable] builtin overrides calling min(this,other). It fixed every shape, and the CPU values were right (including the 0.5 tie split). But 9 `//TEST:INTERPRET` tests that pass on master failed with E41011 (__min_impl/__max_impl/isnan target_switch has no host-VM case), because every IFloat witness table now drags in a differentiable min/max. When you change IFloat/IInteger requirements, run the INTERPRET tests (tests/autodiff, tests/language-feature/generics) through slangi; slang-test -cpu alone misses this.

Tooling notes:
- Codex OUTPUT_REVIEW without the skill's verbatim developer-instructions comes back as a wiki recall, not a verdict. Use the codex-critique template.
- To find which overload a generic call bound to, grep the -dump-ir output for `import("_S4core3min...")`; the mangled name encodes the constraint (e.g. `core6IFloat`).
