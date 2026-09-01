---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788199139448-7mv6t2
written_at: 2026-08-31T18:05:29.800Z
---

# SPIR-V pointer-to-sized-array ArrayStride: two distinct pointer types carry different strides

Context: shader-slang/slang PR #12698, `getPointerArrayStrideValue` in `slang-emit-spirv.cpp` (~:2022, emit site ~:2563). The fix widens the guard from `as<IRUnsizedArrayType>` → `as<IRArrayTypeBase>` so pointers to *sized* arrays also take the element-stride path.

Key mechanism (verified by emitting SPIR-V from a minimal `LayoutPtr<float4[4]>` shader with `slangc -target spirv-asm -emit-spirv-directly`): a user-written `Ptr<T[N]>`/`LayoutPtr<T[N]>` inside a buffer is lowered by `lowerBufferElementTypeToStorageType` (slang-emit.cpp) into `Ptr<struct { T[N]; }>` — the raw array becomes a struct-wrapped member. So in the emitted SPIR-V there are TWO distinct pointer types, and each needs a DIFFERENT ArrayStride:

1. `%_ptr_..._Array_std430_...` — pointer to the `OpTypeStruct { T[N] }` **wrapper**. This is the type the pointer variable `p` actually has. Whole-object stepping — `p[i]` (yields a whole `T[N]`) and `p + 1` — lowers to `OpPtrAccessChain` over THIS pointer, so its ArrayStride must be the whole-array size (e.g. 64 for `float4[4]`). Pointee is a struct → falls through to `getSizeAndAlignment`; UNCHANGED by the fix and correct.

2. `%_ptr_..._arr_v4float_int_4` — pointer to the **raw array** type. This only ever appears mid-access-chain as the base of an element-indexing `OpAccessChain` (`(*p)[i]` / `p[0][i]`). Per SPIR-V spec, ArrayStride on a pointer-to-array-element is the stride between consecutive *elements* (16 for `float4[4]`), NOT the whole-array size. Pre-fix it wrongly carried 64, so drivers that read the pointer decoration computed `base + i*64` instead of `base + i*16` on a DYNAMIC index → wrong memory. Constant indices fold to a fixed byte offset and never multiply by this stride, so they were unaffected (classic "switch-version works, dynamic-index-version glitches" symptom).

Takeaways:
- ArrayStride "should equal the whole array size" is a common wrong intuition. On a pointer-to-array-*element* it is the ELEMENT stride; the whole-array size belongs on a *different* pointer (the struct wrapper) used for object stepping.
- Element stride ≠ element size in std140 (e.g. `float2` element stride is 16 in std140, 8 in std430) — reuse the array type's own ArrayStride, which is already correct in the dump.
- To reproduce/inspect this class of bug GPU-free: emit `-target spirv-asm -emit-spirv-directly` and grep `ArrayStride` + `OpAccessChain`/`OpPtrAccessChain`; the access-chain trace shows exactly which pointer type's stride each index consumes.
