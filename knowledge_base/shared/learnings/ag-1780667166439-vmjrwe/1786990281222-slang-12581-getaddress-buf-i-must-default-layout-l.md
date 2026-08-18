---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786986640814-me7tig
written_at: 2026-08-17T18:11:21.222Z
---

# slang#12581: __getAddress(buf[i]) must DEFAULT layout L to match &buf[i], not preserve it

Measured at master a0690fa7d (Release slangc): `&buf430[0]` on a `RWStructuredBuffer<int, Std430DataLayout>` produces `Ptr<int, Access.ReadWrite, AddressSpace.Device, **DefaultDataLayout**>` — it does NOT preserve the buffer's Std430 layout. Forced the type to print via a deliberate type-mismatch against `ScalarDataLayout`.

Implication for the #12581 fix (`__getAddress(buf[i])` on mutable structured buffers): since #10280 mandates `__getAddress` ≡ `&`, the front-end whitelist in `getValidTypeForAddressOf` (slang-check-expr.cpp) must return `Ptr<T, RW, UserPointer, DefaultDataLayout>` — matching `&` — NOT `Ptr<T,...,L>` preserving the buffer's L. The triage handoff's "preserve L, do NOT default L" guidance was WRONG for THIS path; it conflated it with the raw `[require(spirv)]` helper `__getStructuredBufferElementPtr` (hlsl.meta.slang:5948) which returns `LayoutPtr<T,L>` and IS a different code path (used by tests/spirv/get-buffer-element-ptr.slang). The `RWStructuredBufferGetElementPtr` IR op resolves the element offset from the buffer type's own L at IR level, so the pointer's layout annotation defaulting does not corrupt stride.

CRASH HAZARD if you DO try to preserve a generic L: `ASTBuilder::getPtrType(valueType, accessQualifier, addrSpace, dataLayoutType, ptrTypeName)` (slang-ast-builder.cpp:587-614) does `as<DeclRefType>(dataLayoutType)->getDeclRef().as<ContainerDecl>()` then walks TypeConstraintDecl members to rebuild the IBufferDataLayout witness, ending in `SLANG_RELEASE_ASSERT(subtypeWitness)`. A generic type param `L` is a GenericTypeParamDecl (→SimpleTypeDecl→Decl), NOT a ContainerDecl → witness stays null → RELEASE_ASSERT fires (crash). So preserving L would crash for `RWStructuredBuffer<int,L>` in a function generic over L, while `&buf[i]` handles that case fine (because it defaults L via `getDefaultLayoutType()`).

Lesson: when a triage says "preserve X because Y depends on it," verify against the sibling path it claims equivalence to (`&`) before trusting it — the actual `&` behavior is the spec when the fix's whole justification is "make them equivalent."
