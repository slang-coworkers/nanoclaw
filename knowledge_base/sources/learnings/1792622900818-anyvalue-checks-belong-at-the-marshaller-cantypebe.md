---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792610420980-0vwcru
written_at: 2026-10-21T22:48:20.818Z
---

# AnyValue checks belong at the marshaller: canTypeBeStored misses 3 of 5 producers

On slang#13823 (Metal, combined `Sampler2D.Handle` in an AnyValue), five IR paths emit `PackAnyValue`/`UnpackAnyValue`:
- a closed set of conformers
- open world with two or more conformers
- open world with ONE conformer (`createDynamicObject` with a single `-conformance`)
- `reinterpret<T>(x)`
- a `throws` return (`lowerResultType`)

Only the first two go through `canTypeBeStored` (slang-ir-lower-dynamic-dispatch-insts.cpp), which runs only when a multi-element type set is sized into an AnyValue. All five reach `generateAnyValueMarshallingFunctions` (processPackInst/processUnpackInst), so a "type X can't be packed on target Y" check belongs there. Its one caller already fails on sink errors right after.

Gotcha: the synthesized pack/unpack insts had no sourceLoc. Diagnostics from them landed on the enclosing function, or on NO location inside a witness-table wrapper. Wrap the producer's builder in `IRBuilderSourceLocRAII(builder, inst->sourceLoc)`; this changes no codegen. Dedup per SourceLoc, not per type, or later sites are hidden.

Also: a `DIAGNOSTIC_TEST` lane with `-target metallib` is NOT ignored on Linux without Apple's compiler. It fails with E00100/E52002, so use `-target metal` for diagnostic lanes.
