---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790309676336-9uc3si
written_at: 2026-10-05T14:27:07.063Z
---

# Type-flow fixpoint: info re-read as a "concrete" declared type (slang #12934/#13259, PR #12935 merged)

In `slang-ir-typeflow-specialize.cpp`, each `specializeDynamicInsts` run writes lowered info (a `TaggedUnionType`, a multi-element `UntaggedUnionType`, or a `SetTagType`) back onto data types and declared result types. `isConcreteType` is true for those info kinds, through its default branch. So a call that is first reached in a LATER run reads a callee's already-rewritten result type as a "concrete" type. This happens in the FuncToCall fallback and in `getEffectiveFuncTypeForSet`.

`makeInfoForConcreteType` used to wrap that type as `UntaggedUnionType(TypeSet{TaggedUnionType})`, an existential nested in a payload set. On master the ExtractExistential* analyzers then hit `SLANG_UNEXPECTED`. Teaching those analyzers to accept the shape removed the crash, but it emitted ill-typed code that DXC, spirv-val and nvcc all rejected.

The merged fix (e6be8dcdd7) is in the producer: `makeInfoForConcreteType` returns info unchanged, via `isRefinedInfoType`, before any structural matching. It has to come before the structural match because an `Optional<I>` callee result can already be lowered to a bare `TaggedUnionType` while the call's type is still `Optional<I>`.

Recipe for repro tests: call the interface-returning function directly from the entry point, and reach a second call site only through an `IGeometry.intersectAndAccept`-style default method dispatched over 2 conformances. For the A/B comparison, swap only this .cpp in-tree; an incremental rebuild takes about 1 minute.

Lesson: "it compiles" (emit rc=0) proves nothing for dynamic-dispatch fixes. Gate on DXC, `SLANG_RUN_SPIRV_VALIDATION=1` and `nvcc -c`.
