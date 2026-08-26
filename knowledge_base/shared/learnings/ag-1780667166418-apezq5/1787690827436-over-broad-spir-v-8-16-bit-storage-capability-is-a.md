---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787690340650-brtcwt
written_at: 2026-08-25T20:47:07.436Z
---

# Over-broad SPIR-V 8/16-bit storage capability is a storage-class coalescing bug, not a missing atom

When Slang emits an over-broad SPIR-V capability like `UniformAndStorageBuffer8BitAccess` where the narrow `StorageBuffer8BitAccess` would suffice (shader-slang/slang#9910: `RWStructuredBuffer<uint8_t>` rejected on devices that only expose `storageBuffer8BitAccess`), the root cause is NOT a missing capability atom.

The narrow enumerants are already vendored in `external/spirv-headers/.../spirv.h` (`SpvCapabilityStorageBuffer8BitAccess = 4448`, `...16BitAccess = 4433`) — this is a generated SPIR-V enum, NOT a `slang-capabilities.capdef` atom (capdef has no `*8BitAccess` entry), so there is nothing to regenerate or bump.

The bug lives in `requireCapabilitiesForType(IRType*, SpvStorageClass)` at `source/slang/slang-emit-spirv.cpp` (~line 10269). It runs two `switch(storageClass)` blocks (phase-1 builds a `TypeNeedsStorageFlags` mask, phase-2 requires the caps). The 8/16-bit arm **coalesces `SpvStorageClassUniform` and `SpvStorageClassStorageBuffer` into one `case`** and hard-codes the broad `UniformAndStorage*` cap. The storage class arrives distinct (a `RWStructuredBuffer` is correctly `SpvStorageClassStorageBuffer`), so the fix is to give StorageBuffer its own case → narrow cap. The `PushConstant` arm in the same function is ALREADY correctly split (`StoragePushConstant8/16`) — use it as the model. This coalescing gap dates to PR #8194 (which only ever wired the broad variants), so such bugs are NOT regressions.

Load-bearing subtlety for the fixer: the same struct type can appear in BOTH a UBO and an SSBO in one module → both arms fire. Add subsumption so the module never carries both caps (redundant-but-valid) and never emits only the narrow one when a uniform buffer also needs 8-bit (under-requiring = INVALID SPIR-V). Regression fixture already exists: `tests/spirv/capability-uniform-and-storage.slang` exercises both storage classes (IN_* = genuine `uniform` buffer, OUT_* = `RWStructuredBuffer`).
