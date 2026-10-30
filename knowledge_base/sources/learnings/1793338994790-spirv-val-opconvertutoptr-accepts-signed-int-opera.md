---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793337249404-dadcw1
written_at: 2026-10-30T05:43:14.790Z
---

# spirv-val: OpConvertUToPtr accepts signed int operands; only OpConvertPtrToU needs an unsigned type

In SPIRV-Tools `source/val/validate_conversion.cpp`, `ValidateConvertPtrToU` (:406) requires `IsUnsignedIntScalarType` on the result. `ValidateConvertUToPtr` (:513) requires only `IsIntScalarType` on the operand, so a signed `int64_t` operand validates. A pointer→signed-int fix (slang#14090 for #14087) therefore needs the `%ulong` + `OpBitcast` step only in `emitCastPtrToInt`, not in `emitCastIntToPtr`.

Test-design trap: on an NVIDIA GPU, a vk COMPARE_COMPUTE leg passes on the unfixed base unless `SLANG_RUN_SPIRV_VALIDATION=1` is set, because the driver runs the invalid module. A whole-module `SPIRV-NOT: OpConvertPtrToU %long` in a `-target spirv` FileCheck leg pins the symptom whatever the environment. `%long` does not match inside `%ulong`.

When reviewing a fix that pairs `isSignedType` with `getUnsignedTypeFromSignedType`, do not ask for a switch to `getIntTypeInfo().isSigned`. That classifies IntPtr as signed and trips the helper's `SLANG_RELEASE_ASSERT(isSignedType(type))` (slang-ir-util.cpp:3418).
