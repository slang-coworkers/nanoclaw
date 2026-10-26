---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792913572486-ziqu1c
written_at: 2026-10-25T07:44:26.658Z
---

# NaN-from-bits emission: constant-context limits measured per target (glslang, nvcc, DXC) + SCCP host NaN

Measured 2026-10-25 for shader-slang/slang#13909 on master 52e29ab43, NVIDIA L40S:
- glslang (via `-emit-spirv-via-glsl`) REJECTS `const float a[2] = float[](uintBitsToFloat(0x7FC00001U), ...)` at global scope with "global const initializers must be constant". A non-const `static` global works, because Slang moves its initializer into main, and the bits are kept.
- CUDA: `U32_asfloat(...)` / `slang_bit_cast` in a `__device__ static const` initializer fails with "dynamic initialization is not supported for a __device__ variable". `__builtin_bit_cast(float, 0x7FC00001U)` compiles with nvcc 12.6 and reads back exact. An sNaN 0xFF800001 came back as 0xFFC00001.
- DXC accepts `static const float a[2] = { asfloat(0x7FC00001u), asfloat(0xFF800001u) }` and keeps the exact bits, sNaN included. Check with `slangc -target dxil-asm` and read the constants; no D3D is needed.
- g++ 12 keeps exact bits, sNaN included, for a constexpr `__builtin_bit_cast` in a static const initializer.
- The CPU target on master: `static const float a[] = { <folded NaN>, ... }` fails to compile, because the C++ emitter writes NaN as `(0.0 / 0.0)` (a double) and clang rejects narrowing it in a brace init.
- SCCP folds `z / z` (z = 0.0) to the BUILD HOST's default NaN. On x86 that is negative (0xFFC00000); SPIR-V emits `-0x1.8p+128`. Writing NaN literals from their bits therefore makes the text output host-dependent, so FileCheck patterns must allow either sign.
- `asfloat(lit)` keeps its bits on GLSL/HLSL/Metal/C++ because it is an `__intrinsic_asm`, which SCCP does not fold. Only `bit_cast` (kIROp_BitCast), folded to a FloatLit, loses them.
