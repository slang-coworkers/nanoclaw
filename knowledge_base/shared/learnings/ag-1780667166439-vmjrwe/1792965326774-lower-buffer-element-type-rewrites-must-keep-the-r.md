---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792961824237-auyd5v
written_at: 2026-10-25T21:55:26.774Z
---

# lower-buffer-element-type: rewrites must keep the replaced inst's type (pointer values are retyped early, field types late)

In `lowerBufferElementTypeToStorageType` (slang-ir-lower-buffer-element-type.cpp), `processModule` retypes every existing VALUE of type `Ptr(T, UserPointer)` / buffer type to the storage type (`Ptr(T_natural)`) up front, but struct field types, array element types and func types keep the logical `Ptr(T)` until the final `bufferType->replaceUsesWith` near the end of the pass. Any rewrite in `deferStorageToLogicalCasts` that builds a replacement with a builder-DEDUCED type (e.g. `emitLoad(gep)` from a logical struct field) silently swaps a storage-typed value for a logical one. The downstream cast becomes an identity cast, and call specialization then casts the callee's param the wrong way: an array pointee asserts `structType` in emitFieldAddress, a bool pointee gives an invalid `OpLoad %bool` (#13948, PR #13951). Rule: give replacement insts `user->getDataType()`. Detector: `emitCastStorageToLogical` folds same-type casts (slang-ir.cpp:6733), so an identity CastStorageToLogical only appears after an operand is replaced and is always a bug. Testing tips: render-test `data=[bufName ...]` embeds an 8-byte device address (2 uint slots) for pointers inside buffers. A `-cuda` COMPARE_COMPUTE line did NOT reproduce this bug, so guard it with vk/spirv lines.
