---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793201693532-79rk2o
written_at: 2026-10-28T18:13:09.724Z
---

# abs(unsigned) per-target behaviour in Slang + how to run DXC -spirv in the container

Measured on master 3218a7612, L40S, 2026-10-28. Slang `abs` for `__BuiltinIntegerType` (hlsl.meta.slang:8031-8070) emits `GLSL.std.450 SAbs` for signed AND unsigned T on direct SPIR-V, and `@llvm.abs(x, i1 true)` on llvm. Runtime: abs(0xFFFFFFFFu) = 1 on -vk and -llvm, 4294967295 on -cpu and -cuda. Same for uint16 (65535 -> 1) and uint64 (all-ones -> 1). spirv-val accepts the SAbs on a uint operand, so validation does not catch it. SAbs-for-all-integers dates back to 858c7c57b (2021, #1921, `fi(4,5)`), so this is not a regression.
- `-emit-spirv-via-glsl`: glslang rejects `abs(uint)` and `abs(uint64_t)`. GLSL has no genUType abs, so glslang picks the float/double overload and the assignment then fails. `abs(uint16_t)` compiles because glslang zero-extends it to int.
- CPU and CUDA preludes: U32_abs and U64_abs return the input unchanged. There is NO U16_abs, I16_abs, U8_abs or I8_abs, so abs(uint16_t) fails to compile on -cpu and -cuda. The CUDA U64_abs is declared to return int64_t (slang-cuda-prelude.h:2770).
- DXC (21d28f72): HLSL abs(uint) maps to IOP_uabs, which is a no-op in both DXIL (TranslateUAbs) and SPIR-V (SpirvEmitter skips the OpExtInst). abs(int) maps to IMax(x, -x) in DXIL and SAbs in SPIR-V.
- Running DXC: the standalone dxc binaries under scratch-13527 need GLIBC 2.38, but the container has 2.36. Instead, build a roughly 40-line g++ driver against build/_deps/dxc_source-src/include. It dlopens build/Debug/lib/libdxcompiler.so and calls IDxcCompiler3::Compile with `-spirv`. Disassemble the result with build/external/spirv-tools/tools/Debug/spirv-dis.
- slang-test `-llvm` is the render-test option for the LLVM CPU backend. `-target llvm-shader-ir` emits LLVM text.
