---
title: "Slang CUDA float3 loop arithmetic ~3x slower than float4 (vec3 layout + swizzle-constructor emission)"
type: learning
topic: slang-compiler
source: learnings/1783908909248-slang-cuda-float3-loop-arithmetic-3x-slower-than-f.md
---

# Slang CUDA float3 loop arithmetic ~3x slower than float4 (vec3 layout + swizzle-constructor emission)

**Symptom (SlangPy #1059):** A hot compute loop accumulating in `float3` runs ~2.9x slower on the **CUDA backend** than the identical math in `float4` (or named scalars). Vulkan runs all variants at parity — the penalty is **CUDA-emission-path specific**, and it tracks the `float3` **type**, not the arithmetic volume (scalar and float4 formulations are both fast).

**Root cause (upstream `shader-slang/slang`, NOT SlangPy):**
- `source/slang/slang-ir-layout.cpp` `CUDALayoutRules`: vec3 alignment = element alignment → `float3` is **12 bytes, 4-byte aligned**; vec2/vec4 = element*count capped at 16 → `float4` is **16 bytes, 16-byte aligned**. Slang emits CUDA's *native* `float3`/`float4`.
- `source/slang/slang-emit-cuda.cpp` `CUDASourceEmitter` (`calcTypeName`→`getVectorPrefix`): on the CUDA target, swizzles like `.rgb`/`.xyz` are lowered to **component-by-component struct constructors** (`float3{a,b,c}`), whereas Vulkan/SPIR-V emits a single `OpVectorShuffle`. This struct/constructor form is the plausible reason NVRTC fails to keep `float3` in registers while `float4` stays vectorized.

**Ownership rule of thumb:** SlangPy does NOT vendor the Slang compiler (`.gitmodules` has only `external/slang-rhi`; Slang is a prebuilt binary via `FetchContent`). SlangPy is *transparent* to vector types — `codegen.py`/`calldata.py`/`boundvariable.py` handle vectorization *dimensionality*, never lower float3↔float4. The only backend-specific SlangPy behavior is dispatch strategy (`dispatchdata.py:152` `use_param_block_for_call_data = type != DeviceType.cuda`), unrelated to vector emission. **So any "float3/vector arithmetic is slow/wrong on CUDA" report where the vector math is in the *user's* .slang body is an upstream shader-slang/slang codegen issue — SlangPy has no lever.**

**Precedent:** shader-slang/slang PR #10031 "Metal: Lower vector2/3/4 types as compacted versions" — Slang already special-cases vec3 layout per target, so a CUDA-side vec3 fix has precedent.

**Workaround for users (from reporter, verified sound):** in hot CUDA kernels accumulate in `float4` (let alpha ride along) or named scalars; read `float4 s = tex[q];` and use `s.r/.g/.b` not `.rgb`; write via lane assignment (`x.a = s.a; dst[tid] = x;`) instead of `float4(v.rgb, a)` constructors. float2 loop math reportedly behaves like float3.

**Confirmation gotcha:** `SLANGPY_PRINT_GENERATED_SHADERS=1` dumps the *Slang wrapper*, NOT the emitted CUDA C++. To inspect the actual float3-struct emission, compile a standalone `slangc -target cuda` repro and read the `.cu` for per-component `float3{...}` constructors around swizzles. Trigger boundary is not fully characterized: minimal epilogue-only float3 write may not repro, but the same pattern behind a helper call + `saturate` in a larger kernel does (inlining boundary matters).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783908909248-slang-cuda-float3-loop-arithmetic-3x-slower-than-f.md`_
