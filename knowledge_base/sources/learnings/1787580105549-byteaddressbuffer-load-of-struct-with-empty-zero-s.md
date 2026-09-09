---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787579317056-ql9pu9
written_at: 2026-08-24T14:01:45.549Z
---

# ByteAddressBuffer.Load of struct with empty/zero-size field emits Load&lt;void&gt;

Issue: `ByteAddressBuffer.Load<Item>(0)` where `Item { float a; Empty b; }` and `struct Empty {}` (zero fields) emits HLSL `.Load<void>(4U)` for the empty field; DXIL fails ("External function used in non-library profile"), SPIRV fails ("divide by zero", stride=0).

Lowering path (all file:line in shader-slang/slang):
- Struct-Load decomposition entry point: `emitLegalLoad` in source/slang/slang-ir-byte-address-legalize.cpp:397. The struct branch is at :408, and the per-field loop `for (auto field : structType->getFields())` is at :436-470 — it computes each field offset via `getOffset` (:450) and recurses `emitLegalLoad(field->getFieldType(), ..., immediateOffset + fieldOffset, ...)` (:460), then `emitMakeStruct` (:476).
- Base case `emitSimpleLoad` (:807) emits `kIROp_ByteAddressBufferLoad` with the type (:988). HLSL emit prints `inst->getDataType()` as the `.Load<T>` type arg (slang-emit-c-like.cpp:2997-3006 `emitType(inst->getDataType())`). SPIRV path (translateToStructuredBufferOps) divides `offset / typeStride` where typeStride = natural stride (:875-881) — an empty/void type has stride 0 → divide-by-zero.
- Empty struct natural size: `CASE(Void, 0, 1)` at slang-ir-layout.cpp:134; struct layout loop (:148) reports size 0 for a fieldless struct.
- The byte-address pass has NO skip for zero-sized/void fields. Precedent for skipping void-lowered fields exists in slang-ir-lower-buffer-element-type.cpp:861 and :900 (`if (as<IRVoidType>(...)) { fieldId++; continue; }`) and slang-ir-cleanup-void.cpp:257 removes void fields from structs (consumer, not producer).
- Frontend lowers `Empty {}` to an empty IRStructType (createStructType at slang-lower-to-ir.cpp:12481; field loop :12614-12637 adds zero fields), NOT directly to void. `legalizeEmptyTypes` (slang-ir-legalize-types.cpp:4207) reduces empty struct to LegalType::none but runs only for Metal (slang-emit.cpp:1908) / CPU-CUDA (:1918) before byte-address (:2135), plus a late all-target pass at :2549 AFTER byte-address.

Fix location: add a zero-size/void-field skip in the `emitLegalLoad`/`emitLegalStore` struct-field loops (slang-ir-byte-address-legalize.cpp:436 and :1429) — skip a field whose natural size is 0 (query getNaturalSizeAndAlignment on fieldType) before recursing, mirroring the void-field skip pattern already used in slang-ir-lower-buffer-element-type.cpp.
