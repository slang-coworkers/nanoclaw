---
title: "Empty-struct field emit-skip is incomplete — must remove fields in IR, not at emit"
type: learning
topic: misc
source: learnings/1781725277930-empty-struct-field-emit-skip-is-incomplete-must-re.md
---

# Empty-struct field emit-skip is incomplete — must remove fields in IR, not at emit

For slang CPU/CUDA empty-struct layout bugs (#8125/#7612): the obvious fix — skip empty-struct field *declarations* in `CLikeSourceEmitter::emitStructDeclarationsBlock` (slang-emit-c-like.cpp:4477, beside the existing `void` skip, via `isStructEmpty`) — **fixes the reported ParameterBlock offset crash but is fundamentally incomplete and introduces a regression.** An empty field's presence must stay consistent across THREE emit sites: its struct declaration, `MakeStruct` construction (slang-emit-c-like.cpp:2914 emits all operands positionally), and `FieldExtract`/`FieldAddress` accesses (2486/2503 emit `base.field` unconditionally). Skipping only the declaration strands references to the omitted member when the other insts survive to emit → downstream compile failure `no member named 'e_1'`.

Key traps:
- It LOOKS fixed at `-target cpp` default-opt because the optimizer folds empty-field reads into a fresh value. But slang-test's `-cpu` COMPARE_COMPUTE compiles emitted C++ with **LLVM at -g3**, which disables that fold, so surviving `FieldExtract`/`FieldAddress`/`MakeStruct` of an empty field reference the omitted member → compile error. Always test the access + makeStruct shapes (a `[noinline]` empty-by-value call; `S s = {{},5}`) on `-cpu`, not just `-target cpp` emit inspection.
- Emit-only guards can't close it: `isFieldUsed` (slang-ir-dce.cpp:323) catches `FieldExtract`+used-`FieldAddress` but NOT `MakeStruct` operands, and `isPtrUsed` ignores stores → store-only/constructed empty fields still strand.
- Approach B via `isSimpleType` is also insufficient: `legalizeTypeImpl` (slang-legalize-types.cpp:1193) returns a layout/public-decorated "simple" struct as-is WITHOUT recursing into its fields, so the framework never reaches a nested empty field (e.g. a ParameterBlock element).

Correct fix = a guaranteed IR transform (opt-level-independent) that removes empty struct fields AND rewrites all their uses to fresh empty values: `FieldExtract`→`emitDefaultConstruct`; `FieldAddress`→address of a fresh local (cover load/store/call/transitive-ptr uses); `trimMakeStructOperands`+`removeStoresIntoField` (existing helpers); then remove the field. Consistent by construction. Scope to the C-like/CPU-CUDA path (gate by `shouldLegalizeExistentialAndResourceTypes`, not a literal target check). Cross-module is moot at leaf emit — reflection already excludes empty fields, so this just aligns codegen with reflection. The type-layout warning at slang-type-layout.cpp:4878 ("final declarations need to ALSO eliminate zero-size fields") is the documented contract — but "eliminate" must mean IR-level removal of the field + its uses, not a declaration-only emit skip.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1781725277930-empty-struct-field-emit-skip-is-incomplete-must-re.md`_
