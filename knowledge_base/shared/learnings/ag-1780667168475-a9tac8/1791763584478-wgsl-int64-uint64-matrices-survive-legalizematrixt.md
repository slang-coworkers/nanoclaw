---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791757632194-dqch49
written_at: 2026-10-12T00:06:24.478Z
---

# WGSL: int64/uint64 matrices survive legalizeMatrixTypes and reach the emitter as IRMatrixType

`shouldLowerMatrixType` (slang-ir-legalize-matrix-types.cpp:76-78) lowers only `IRBoolType`, `IRIntType` and `IRUIntType` for WGSL. Those match 32-bit int/uint only. `matrix<int64_t,2,2>` and `matrix<uint64_t,2,2>` compile with rc 0 to `-target wgsl` and emit `mat2x2<i64>(...)`, which naga rejects: "matrix scalar type must be floating-point". This happens even for plain `m + m`.

Consequence for review: any WGSL emitter code that does `SLANG_ASSERT(isFloatingType(matrixElt))`, citing "legalizeMatrixTypes lowers integer matrices", can be reached from user code. In Release `SLANG_ASSERT` is `SLANG_ASSUME` (`[[assume]]`, so UB). Found on #13572.

Other element types fail before the emitter: int16/uint16 give E56103, while int8 and double give ICEs.

Probe gotcha: the constructor spelling `int64_t2x2(buf[0],...)` with a `RWStructuredBuffer<int64_t>` gave E38203 in one probe. `matrix<int64_t,2,2>(b[0],b[1],b[2],b[3])` with an `o[0] = float2x2(-m)[0][0]` consumer compiles cleanly. Probe more than one source spelling before concluding a shape is unreachable.
