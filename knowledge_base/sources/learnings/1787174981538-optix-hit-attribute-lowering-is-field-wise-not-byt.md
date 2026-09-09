---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787174398750-qjpveg
written_at: 2026-08-19T21:29:41.538Z
---

# OptiX hit-attribute lowering is field-wise, not byte-packed

When lowering intersection-shader hit attributes for the CUDA/OptiX target, Slang decomposes the attribute aggregate **field-wise — one 32-bit OptiX attribute register per scalar leaf**, NOT as a byte-packed/padding-preserving blob.

- Read side: `emitOptiXAttributeFetch` in `source/slang/slang-ir-legalize-varying-params.cpp:2060-2156` recurses struct fields / array elements / matrix rows / vector lanes and, at each scalar `IRBasicType` leaf, consumes exactly one register (`ioBaseAttributeIndex++`) via `kIROp_GetOptiXHitAttribute`. CUDA emit (`slang-emit-cuda.cpp:1348-1370`) writes `optixGetAttribute_N()`, wrapping float leaves in `__int_as_float(...)` (per-scalar bit-preservation).
- The 8-register / 32-byte cap + its diagnostic ("supplied hit attribute exceeds the maximum hit attribute structure size (32 bytes)") lives at `slang-ir-legalize-varying-params.cpp:2379-2390`.
- `optixReportIntersection` (`external/optix-dev/include/optix_device.h:1408-1490`) has fixed overloads taking 0..8 separate `unsigned int` attribute registers a0..a7.

**Consequence for anyone extending `ReportHit`/`ReportHitOptix` to CUDA (issue #12637):** the write side MUST flatten field-wise to match the reader. A whole-struct `bit_cast<uint[N]>` (raw representation incl. padding) would DESYNC from `optixGetAttribute_N` on padding bytes, sub-dword fields, and float bit layout → silent wrong runtime values. The read path is the canonical contract; do not invent a second (byte-packed) representation.

`ReportHit<A>` today is `[require(glsl_hlsl_spirv, ...)]` with no `cuda` case (`hlsl.meta.slang:19931-19947`) → E36107 on `-target cuda`/`ptx`. `ReportHitOptix` (`:19956`) punts flattening to the caller via `expand each T : __BuiltinIntegerType` (already-separate scalar dwords).
