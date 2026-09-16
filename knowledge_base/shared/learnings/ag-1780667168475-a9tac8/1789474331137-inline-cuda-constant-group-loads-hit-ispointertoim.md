---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789471037863-kfimln
written_at: 2026-09-15T12:12:11.137Z
---

# Inline CUDA __constant__ group loads hit isPointerToImmutableLocation via the ConstantBufferType type-case (3137), NOT the AddressSpace::Uniform branch

Correction to a slip that BOTH a clarity reviewer and the review coordinator made while reviewing PR #13091 (#13088 fix). When explaining why the CUDA `__constant__` launch-parameter group would be classified immutable (and thus wrongly get `__ldg` without the new guard), the intuitive story is "the group's pointer has address space `Uniform`, so `isPointerToImmutableLocation` returns true via the address-space branch." That is IMPRECISE — verify the actual branch before asserting it.

Verified at `source/slang/slang-ir-util.cpp:3110-3162` (`isPointerToImmutableLocation`), order of checks:
1. `if (isAddressIntoOptiXShaderBindingTable(loc)) return false;` — SBT exclusion (#10188).
2. `switch (loc->getOp())` peels GetStructuredBufferPtr / RWStructuredBufferGetElementPtr / ImageSubscript. A group `IRGlobalParam` hits default.
3. `type = loc->getDataType();` then `switch (type->getOp())`: **`kIROp_HLSLStructuredBufferType` / `HLSLByteAddressBufferType` / `kIROp_ConstantBufferType` (3137) / `kIROp_ParameterBlockType` (3138) → return true.**
4. ONLY THEN the `IRPtrTypeBase` branch (3147-3160) with the `AddressSpace::{Uniform,UniformConstant,Input,...}` cases (3154).

For an inline `__constant__` group member load, `getRootAddr(load->getPtr())` returns `%globalParams`, whose type is `ConstantBuffer<GlobalParams>` (an `IRUniformParameterGroupType`, concretely `kIROp_ConstantBufferType`). So the function returns true at the **type-case (3137)** and the `IRPtrTypeBase`/`AddressSpace::Uniform` branch is NEVER reached — the group param is not a pointer type. Anyone quoting the "AddressSpace::Uniform" mechanism for this input is citing dead-for-this-input code.

Structural coherence this exposes: the OptiX SBT root is ALSO `ConstantBuffer<>`-typed (see the comment at util.cpp:3112-3115), so it too would return true at 3137 — which is why the SBT needs its own explicit exclusion at 3116, and why the constant-group fix (#13091) excludes at the CALLER (before `isPointerToImmutableLocation` is called) rather than adding an address-space case. Both are exclusions of ConstantBuffer-typed immutable roots, for different reasons (SBT host-mutated between dispatches; `__constant__` group is a constant-memory address `__ldg` can't take).

Meta-lesson: when a review confirmation quotes a mechanism, trace it to the exact switch-case that fires for THAT input's type — the `type->getOp()` buffer-type cases short-circuit before any address-space reasoning, so "address space X" explanations for buffer-typed roots are frequently the wrong branch.
