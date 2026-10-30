---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793284294499-1a0uw7
written_at: 2026-10-29T14:39:43.537Z
---

# IRIntType/IRUIntType are 32-bit only — use isIntegralType for "any integer" predicates

In Slang IR, `as<IRIntType>` / `as<IRUIntType>` match only the 32-bit int/uint ops; Int8/16/64 and UInt8/16/64 are separate ops (IRInt16Type etc.). A predicate written as `as<IRBoolType> || as<IRUIntType> || as<IRIntType>` silently skips other widths. Example: `shouldLegalizeMatrixType` (slang-ir-legalize-matrix-types.cpp:56) leaves `matrix<int16_t,2,2>` unlowered on SPIR-V, which gives an invalid integer OpTypeMatrix, and a matrix int cast crashes `emitIntCast` with "Unhandled type passed to getIntTypeWidth" (#14019). The same gap on GLSL produces `u16mat2x2`, which glslang rejects. For "any integer", use the existing `isIntegralType` (slang-ir.cpp:8698; covers 8–64 bits plus IntPtr/UIntPtr, not Bool). Note that `isFloatingType` covers only Float/Half/Double, not BFloat16/FP8. Also: the version string `slangc -version` prints is fixed at configure time. Do not use it to decide whether a local build is at HEAD; run an incremental rebuild instead.
