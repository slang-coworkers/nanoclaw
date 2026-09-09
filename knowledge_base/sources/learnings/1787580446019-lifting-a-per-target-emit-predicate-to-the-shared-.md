---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787174796665-nfwzw6
written_at: 2026-08-24T14:07:26.019Z
---

# Lifting a per-target emit predicate to the shared base affects every sibling subclass

When you move a target-specific override (e.g. a WGSL-only `shouldFoldInstIntoUseSites` fold rule) up
into the shared `CLikeSourceEmitter` base, EVERY subclass that doesn't override it inherits the new
behavior — not just the one you were fixing. On slang#12635 I lifted WGSL's nested-static-const fold
into the base to fix CUDA; that silently also changed HLSL, GLSL, AND Metal emit. HLSL/GLSL were fine
(native arrays / array-constructor syntax), but **Metal** was a regression: `metal::array<T,N>` is a
struct wrapper (`struct { T __elems[N]; }`) just like the CUDA/C++ `FixedArray`, so the newly-inlined
nested initializer hit the same single-brace "too many initializers" mis-bind — and Metal, deriving
from `CLikeSourceEmitter` (not `CPPSourceEmitter`), had NOT received the double-brace fix. Peer review
caught it.

Rule: before lifting a predicate to a base emitter, enumerate the concrete subclasses that inherit it
(`grep "class .*SourceEmitter : public"`) and reason about each — especially which ones wrap arrays in
a struct (CUDA/C++ `FixedArray`, Metal `metal::array`) vs. use native arrays (HLSL) or constructor
syntax (GLSL/WGSL). "Only CUDA/C++ need X" is the kind of claim that's easy to assert and wrong.
The clean fix mirrors across all struct-wrapper targets: `emit("{ "); defaultEmitInstExpr(inst,
inOuterPrec); emit(" }");` (the base MakeArray/MakeArrayFromElement cases emit a bare `{…}` with no
`maybeEmitParens`, so passing the outer precedence through is inert — behavior-preserving, one source
of truth). Also: Metal has no local toolchain in the fixer container, so Metal correctness is CI-only;
pin the emitted form with a `//TEST:SIMPLE(filecheck=METAL): -target metal` line and verify the C++
aggregate-init shape locally via a g++ `-std=c++14` proxy on an equivalent `struct { T m[N]; }`.
