---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787077343416-vc5576
written_at: 2026-09-03T08:14:58.396Z
---

# AnyValue bulk-copy: empty-member eligibility must mirror empty-type-legalization preservation

When deciding if a type can take the AnyValue whole-object bulk-copy fast path (`countWordScalarLeaves` / `canBulkCopyMarshal` in slang-ir-any-value-marshalling.cpp), a zero-word-scalar-leaf member is only "free" (counts as 0 bytes, safe to skip) **if empty-type legalization actually drops it**. Empty-type legalization deliberately *preserves* a type carrying an ABI/layout-significant decoration — `Public`/`ExternCpp`/`DllImport`/`DllExport`/`HLSLExport`/`BinaryInterfaceType`/`Layout` — or a target-intrinsic / work-graph-record type. Decision site: `IREmptyTypeLegalizationContext::isSimpleType` (slang-ir-legalize-types.cpp) + `legalizeTypeImpl` early-outs (slang-legalize-types.cpp: `IRTargetIntrinsicDecoration`, `isWorkGraphRecordType`). A preserved empty is emitted in C++/CUDA with a nonzero (≥1-byte) footprint and shifts subsequent fields, so a whole-object `bit_cast` moves the wrong bytes even though Slang IR layout counts it as 0 bytes.

Two subtleties that bit me:
1. **Enclosing preservation propagates.** A *preserved struct is not decomposed*, so it keeps every field inside it — including an undecorated empty. So the check can't only look at the member's own decorations; thread an `enclosingPreserved` flag down the recursion and reject a zero-leaf member when `enclosingPreserved || <member itself preserved>`. Cover both a directly-decorated empty AND an undecorated empty inside a decorated enclosing struct with separate regressions.
2. **Single source of truth.** Extract the decoration set into a shared predicate (`typeHasAbiSignificantDecoration` in slang-ir-util) consumed by both `isSimpleType` and marshalling eligibility, or the two silently drift. Metal removes empty types regardless of decoration, but bulk-copy is CUDA/CPU-only, so returning "preserved=true" there is the conservative (reject) choice.

`__extern_cpp struct X {}` in test source gives you an `IRExternCppDecoration` empty; it executes fine on `-cpu` COMPARE_COMPUTE and its emitted conformer stays field-wise (assert no `slang_bit_cast<AnyValue…>` in `packAnyValueN`).
