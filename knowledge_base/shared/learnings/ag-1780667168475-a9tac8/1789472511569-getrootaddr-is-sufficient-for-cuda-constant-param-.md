---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789471037863-kfimln
written_at: 2026-09-15T11:41:51.569Z
---

# getRootAddr is sufficient for CUDA __constant__ param group (unlike SBT) — why the peel-walker is not needed

Context: PR #13091 (fixes #13088) added a guard in `slang-ir-cuda-immutable-load.cpp` that skips `__ldg` lowering when `getRootAddr(load->getPtr())` is an `IRGlobalParam` of `IRUniformParameterGroupType` (the type CUDA emits as `extern "C" __constant__ SLANG_globalParams`). Prior art (#10188/#11152 false-safe → #12119 fix) makes any `getRootAddr`-keyed guard suspect, because `getRootAddr` peels only `{GetElementPtr, FieldAddress, NodeOutputRecordGetElementPtr}` (slang-ir-util.cpp:936-953) and NOT `BitCast`/`GetOffsetPtr`/`Reinterpret`/`PtrCast`. So the question was: can a cast/offset op sit between the `Load` and the group param and defeat the guard?

Verified answer: **PEEL-SET SUFFICIENT for the CUDA constant-param-group case.** The reuse of `getRootAddr` (rather than mirroring the SBT `isAddressIntoOptiXShaderBindingTable` peel-walker) is the correct layer, for a *structural* reason that generalizes:

1. **The #10188 SBT casts came from pointer ACQUISITION, not member legalization.** SBT reads acquire their base via `GetOptiXSbtDataPtr` reinterpreted to the element type — that reinterpret is the cast `getRootAddr` couldn't peel. That's why #12119 keyed the walker on `GetOptiXSbtDataPtr` *inside* `isPointerToImmutableLocation`, not on `getRootAddr`. The `__constant__` group has **no acquisition cast**: it is a direct `IRGlobalParam` accessed structurally via `FieldAddress`/`GetElementPtr`. That single structural fact is why `getRootAddr` reaches it.

2. **CUDA uses the Default buffer-element lowering policy + Natural layout** (slang-emit.cpp:2616-2618; slang-ir-lower-buffer-element-type.cpp:2414-2417). `DefaultBufferElementTypeLoweringPolicy::lowerLeafLogicalType` (~2763-2841) lowers ONLY matrices; bool / 8-16-32-64-bit / half-float-double / vectors are IDENTITY. **bool→int lowering is SPIRV-direct-only** (Khronos policy, gated on `shouldEmitSPIRVDirectly()` = false for CUDA). So the "bool/16-bit splices a cast" mechanism from #10188 does not exist on the CUDA/Default path. Row-major matrices are also identity (CUDA `defaultMatrixLayout = ROW_MAJOR`); only a column-major member matrix is lowered — and even then the boundary `CastStorageToLogical` is pushed down/materialized so the group→Load chain stays pure `FieldAddress`/`GetElementPtr` (lowerMatrixAddresses ~2244-2388).

3. **Identity members ⇒ group is `continue`-skipped entirely** (lower-buffer-element-type.cpp:1833-1835): no `CastStorageToLogical` inserted, access chain untouched. The only bitcast/offset producer in the immutable-load pass (`maybeTranslateTrailingPointerGetElementAddress`) is `AddressSpace::UserPointer`-gated; the constant group is not a UserPointer.

4. **`uniform T*` members are safe by construction:** the pointer-value read roots at the group (guard fires); the device dereference roots at the *loaded* pointer (correctly keeps `__ldg`). Same as `ConstantBuffer<T>`/`ParameterBlock`, which fold into the group as a pointer field and root at a `Load`.

Pipeline caveat that makes this non-trivial: `lowerBufferElementTypeToStorageType` (slang-emit.cpp:2619) DOES run before `lowerImmutableBufferLoadForCUDA` (2657) — the same before/after relation as #10188 — so the safety comes from the Default policy being a near-no-op on CUDA, not from ordering.

Forward-looking residual risk only: a future CUDA layout change (`shouldUseDXLayout` → `D3DConstantBuffer`, ~2460-2464) would lower more matrices, but still through `FieldAddress`/`GetElementPtr` — no new cast source. Adopt the SBT-style peel-walker only if CUDA ever legalizes a group field into a cast-bearing chain.

Review-craft note that recurred here (both correctness and clarity reviewers flagged it): a negative-only regression test for a guard should be paired with a positive test that actually exercises the guard's *false* branch. A `StructuredBuffer` positive case does NOT — it takes the separate unconditional `kIROp_StructuredBufferLoad` case and never reaches the `kIROp_Load` guard; use a `ConstantBuffer<T>`/`ParameterBlock` field read (a `kIROp_Load` rooted at a `Load`) instead, or reword the comment.
