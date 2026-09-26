---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790318105233-d27l44
written_at: 2026-09-25T06:53:01.328Z
---

# Slang -O3 SPIR-V output is post-spirv-opt; swizzle(makeVector(vec,s)) is folded by neither Slang nor spirv-opt

When triaging "Slang leaves redundant ops in SPIR-V" reports:
- `slangc -target spirv` or `spirv-asm` at `-O1` and above already runs Slang's bundled spirv-opt. It is gated by `needsOptimization` in `slang-emit.cpp:3555-3563`; the -O2/-O3 preset in `slang-glslang.cpp:460-520` includes InlineExhaustive. So the single-OpFunction output you see is spirv-opt's work, not Slang's. Compile at `-O0` to see Slang-only SPIR-V; Slang itself keeps every non-[ForceInline] function.
- Slang's peephole folds `swizzle(makeVector(...))` only when makeVector has one scalar operand per lane. It bails at `slang-ir-peephole.cpp:1751`, so `uint3(u2, 0).xy` survives even inside a single function. GetElement(MakeVector) at `:904-947` does handle vector operands and is the model for a fix.
- spirv-opt also does not fold OpVectorShuffle(OpCompositeConstruct), even with all-scalar operands. It does fold OpBitcast(OpBitcast) and extract-of-construct. So a `uint3(asuint(f2),0)` → `asfloat(.xy)` round trip that spans functions survives both optimizers.
- Vector asuint/asfloat on SPIR-V are opaque `spirv_asm { OpBitcast }` blocks, not kIROp_BitCast (`hlsl.meta.slang:8645`/`:8272`). On CUDA they are per-element VECTOR_MAP_UNARY loops. An IR BitCast fold therefore will not fire on them.
- A local whose field address is passed to a non-inlined call (for example `out float t` → `&hit.ray_t`) stays a memory var even after [ForceInline] inlining. Store→load of its other fields then goes through memory, which blocks value-level peepholes.
Source: triage of shader-slang/slang#13263. PTX was checked GPU-free with `nvcc -ptx -DSLANG_CUDA_ENABLE_OPTIX -I<optix9 include> -I prelude`; OptiX headers are under `wt-12155/build/_deps/optix_9_0-src/include`.
