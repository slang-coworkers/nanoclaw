---
title: "Slang CUDA & CPU/C++ Backends: C-Family Emitter Codegen"
type: concept
group: slang-backends
tags: [cuda, cpp, c-family-emitter, swizzle, float3, codegen-perf, nvrtc, slang-12073, ldg, immutable-load, vectorized-load, static-const, nan, bit-cast]
source_count: 33
---

# Slang CUDA & CPU/C++ Backends: C-Family Emitter Codegen

The CUDA and CPU/C++ targets share one code path — `CPPSourceEmitter` (`source/slang/slang-emit-cpp.cpp`), which `CUDASourceEmitter` inherits (`slang-emit-cuda.h:44`). This "C-family emitter" is distinct from the SPIR-V and HLSL paths, and its lowering choices produce target asymmetries, including a real performance bug.

## TL;DR

- **CUDA and CPU/C++ are one emitter, so a C-family emit bug is never CUDA-only.** `CUDASourceEmitter` inherits `CPPSourceEmitter`; scope any finding to both targets.
- **A multi-component swizzle READ re-emits a folded base once per component** (`float3{ base.x, base.y, base.z }`). The fold guard misses it: the swizzle is ONE IR use that expands to N textual references.
- **The trigger is a non-trivial folded base** (texture fetch, helper call, `saturate(...)`), not the vector type. A register-resident local base is fast, so a local-base repro is not a repro. `float3`'s 12-byte layout is a red herring; values are always correct.
- **Confirm emit duplication GPU-free by counting occurrences, not lines:** emit `-target cuda` (or `cpp`) and run `grep -o tex2Dfetch | wc -l`. `grep -c` says 1 because the initializer is on one line. `SLANGPY_PRINT_GENERATED_SHADERS=1` dumps the SlangPy wrapper, not emitted CUDA.
- **User workaround:** bind the fetch to a named local and write lanes by assignment; `float4(shade(uv).rgb, a)` calls `shade` 3×.
- **SlangPy does not vendor Slang** (prebuilt FetchContent binary), so a CUDA vector-math bug in the user's `.slang` body is an upstream `shader-slang/slang` issue.
- **`-target cpp` struct layout is C natural alignment (`CPULayoutRulesImpl`)**, not std140/std430; pair a GPU-shared struct with `-fvk-use-c-layout`.
- **`export` roots a host-callable function against DCE; `public` does not.** The gap is `getHLSLExports()`, which checks `HLSLExportDecoration` and never `KeepAlive`.
- **In `-dump-ir`, "appears once then vanishes" is a link drop; "persists to the final module" is an emit-filter drop.**
- **`-target hpp` for a `__extern_cpp` compute entrypoint emits wrapper BODIES** calling a workhorse emitted nowhere; emit prototypes only when `shouldEmitOnlyHeader()`.
- **`-target cuh` exports only `__extern_cpp` globals and `[CudaKernel]` functions.** A `[shader]` entry point gets no prototype, and CUDA varying legalization leaves its `IRFuncType` stale (no `fixUpFuncType`), so a declaration built from it would be wrong.
- **An unused global of a resource type with no CPU prelude struct breaks `host-callable`.** `GlobalParams` fields are never DCE'd, so add a correctly sized prelude type.
- **`-capability cuda_sm_NN` is not an arch selector** (atoms 1_0–9_0 only, applied as a max() floor). After #13286 an explicit `-Xnvrtc -arch` skips every SM-minimum check. NVRTC's own floor is `compute_75` on 12.8+, so CI (CUDA 13.0.1) cannot observe an emitter SM raise below 7.5.
- **A green SPIR-V/HLSL run does not clear CUDA for a param-passing change.** Groupshared-by-ref breaks `getSharedBaseAddr`'s `($0).m_data`; the sm80 `tests/neural/` + `tests/cooperative-matrix/` jobs are the canary. Grep neural/coopmat `__intrinsic_asm` bodies for `$0` `.member` derefs first.
- **Case-less `__target_switch` → silent empty kernel (PTX `ret;`, exit 0); case-present + un-instantiated prelude template → loud NVRTC "referenced but not defined".** Opposite signatures; do not dedup them.
- **A "make-it-a-no-op" prelude typedef is safe only if the type's methods have no target case** for that backend.
- **Use `$TR` (call return type) when an intrinsic needs the result type;** `$T<n>` unwraps a texture to its element type.
- **`$N` reads the enclosing call's args (guarded, E99997); `$[N]` reads the carrier's own operands (unguarded, SIGSEGV).**
- **`precise` on a local leaks to all four C-like targets** via shared `emitTempModifiers`; gate at emit on source-language support.
- **Before narrowing a guard called too broad, check whether the extra inputs are also broken** (half3 texture `Load` is broken too).
- **One CUDA-illegal entry point sinks its clean siblings;** wrap it in `#ifndef __TARGET_CUDA__`. Never guard structured/byte-address buffers; they work on CUDA.
- **A `-target ptx` test is an NVRTC compile check, not a GPU run.** Containers have an L40S anyway; confirm with `nvidia-smi -L`.
- **Editing `hlsl.meta.slang` requires the core-module-header regen** before a built `slangc` shows the change.
- **Global templated CUDA vector operators must be SFINAE-gated** to registered vector types; keep `__half2` packed intrinsics as non-template overloads. Verify with `nvcc -std=c++17`.
- **CPU/CUDA operator typing belongs in the preludes, not in IR casts** (#13684).
- **A bit-exact NaN/Inf in a CUDA `__device__ static const` table needs `__builtin_bit_cast(float, 0x...U)`;** `U32_asfloat`, `slang_bit_cast` and `SLANG_INFINITY` are not constant expressions. `asfloat(lit)` keeps its bits on C-like targets (SCCP does not fold it); `bit_cast` folds and loses them. SCCP's folded NaN takes the build host's sign, so FileCheck must accept either.
- **`__exp2f` does not exist,** so F32 exp2 stays precise under `-fp-mode fast`. Verify each `__*f` name against nvcc.
- **nvcc never merges scalar `__ldg` into wide loads, even with `__builtin_assume_aligned`.** A load that must be both wide and read-only-cached has to be emitted as explicit vector-chunk `__ldg((const uint4*)p)`. A plain aligned deref vectorizes but loses `.nc`/`.CONSTANT`.

## The float3/swizzle-base re-evaluation perf bug (slang#12073, from slangpy#1059)

**Symptom:** a hot loop reading `.rgb`/`.xyz` runs ~3× slower on CUDA (2.87× on L40S/NVRTC 13) than reading a whole `float4` or named scalars; Vulkan and D3D12 show no penalty, and values are correct.

**Root cause.** `CPPSourceEmitter`'s `kIROp_Swizzle` handler (`slang-emit-cpp.cpp:1642-1719`) lowers a multi-component READ to `float3{ base.x, base.y, base.z }`, calling `emitOperand(getBase())` per component. When `shouldFoldInstIntoUseSites` (`slang-emit-c-like.cpp:1685-1687`) folds the base (fetch, load, helper call) into its use, it is duplicated N×; the guard refuses only on >1 IR uses. Repro fetch counts: `f4_all`=1, `f3_loop`=**3**, `f3_epi`=1. SPIR-V (`OpVectorShuffle`) and HLSL (native `.xyz`) evaluate the base once ([swizzle re-evaluates base per component](../learnings/1783910573494-slang-c-family-swizzle-re-evaluates-base-per-compo.md)). Only a non-trivial folded base is slow: the `f3_epi` control (`.rgb` of a local) emits one fetch, while a production epilogue with an expensive helper as base is slow ([re-evaluation, not float3 layout](../learnings/1783910857099-float3-vec3-cuda-slowdown-is-swizzle-base-re-evalu.md)).

**Fix (draft PR #12078).** The `CPPSourceEmitter::shouldFoldInstIntoUseSites` override (`slang-emit-cpp.cpp:1931-1970`) already refuses to fold a vector/matrix value whose user is a reshape/cast, because the cast references it multiple times. A multi-element swizzle is the same case, so the fix returns `false` for an `IRSwizzle` user with `getElementCount() > 1`; the base becomes a temp and `f3_loop` drops to 1 fetch ([#12073 fold guard implemented](../learnings/1783939557238-slang-12073-fix-swizzle-base-fold-guard-implemente.md)).

**Workaround:** `float4 s = tex[q];` then read `s.r/s.g/s.b`, and write `v.a = a; dst[tid] = v;` instead of a constructor-swizzle ([workaround detail](../learnings/1783911049805-slang-cuda-cpp-float3-rgb-swizzle-slowdown-is-base.md)).

**Superseded: the vec3-layout hypothesis.** The first triage blamed `float3`'s 12/4 CUDA layout (vs `float4` 16/16) for defeating NVRTC register allocation and called it CUDA-only ([float3 ~3x slower, layout triage](../learnings/1783908909248-slang-cuda-float3-loop-arithmetic-3x-slower-than-f.md)). Both claims are false: emitted-`.cu` inspection proved base re-evaluation on CUDA **and** CPU/C++, and `f3_epi` falsifies the layout cause. Its ownership rule stands: SlangPy is transparent to vector types and does not vendor Slang, so the bug is upstream.

**Reusable rules.** Confirm with `slangc repro.slang -target cuda -entry <e> -stage compute -o k.cu`, then `grep -o tex2Dfetch | wc -l`. A true layout fact is not thereby the cause; count operations in the emitted code before recording a mechanism. Unrelated to Metal PR #10031 packed-vec3 (a buffer-stride concern).

## Wide Read-Only Loads: nvcc Never Merges Scalar `__ldg` (#13877/#13878)

Consider a 32-byte, 16-aligned record `{ float[3], uint[3], float[2] }` read from immutable memory. Slang's CUDA immutable-load lowering emits one `__ldg` per field, and an alignment hint does not let nvcc fuse them. Measured with nvcc 12.6, `-O3`, sm_89, in PTX and SASS (`cuobjdump -sass`):

| Emitted form | Result |
|---|---|
| Scalar `__ldg` per field + `__builtin_assume_aligned(p,16)` | 8× `ld.global.nc` / `LDG.E.CONSTANT` (NVVM does not combine the ldg builtins) |
| Plain struct copy through `const T* __restrict__`, same hint | 2× `ld.global.v4` / `LDG.E.128`, but the read-only `.nc`/`.CONSTANT` path is lost |
| Plain struct copy, no hint | 8× `LDG.E.CONSTANT` |
| Explicit `__ldg((const uint4*)p)` / `(const float4*)` chunks | 2× `ld.global.nc.v4` / `LDG.E.128.CONSTANT` |

A load that is both wide and immutable therefore needs the emitter to produce the widest aligned vector-chunk `__ldg` and reassemble fields by bit-cast, so honoring an `IRAlignedAttr` in `emitImmutableLoad` (`slang-ir-cuda-immutable-load.cpp`) means chunked vector loads. On master the CUDA emit ignores `IRAlignedAttr`; only SPIR-V (`Aligned N` on PhysicalStorageBuffer) and LLVM consume it. The per-element split a fix must undo comes from `deferBufferLoad` (`slang-ir-defer-buffer-load.cpp`, all targets), `lowerImmutableBufferLoadForCUDA::createLoadFuncForType` (`slang-ir-cuda-immutable-load.cpp:107`, arrays per element, structs per field), and `createArrayUnpackFunc` (`slang-ir-lower-buffer-element-type.cpp:527`, SPIR-V). SASS check without a runtime: `nvcc -cubin -arch=sm_89 -O3 -I<slang>/prelude x.cu && cuobjdump -sass x.cubin | grep -oE 'LDG[.A-Z0-9]*' | sort | uniq -c` ([nvcc won't merge scalar __ldg](../learnings/1792700658146-cuda-nvcc-won-t-merge-scalar-ldg-into-wide-loads-e.md)). The correctness guard on the same pass (skipping `__ldg` for the `__constant__` launch-parameter group) is on [[wiki/concepts/misc-f0909b5-cuda-codegen-triage.md]].

## CPU/C++ Host Targets: Struct Layout, `-target hpp`/`cpp` Rooting, Header-Only Prototypes (#9401/#9403), `-target cuh` (#14033)

`-target cpp` uses `CPULayoutRulesImpl` natural alignment, so a struct shared with C++ that also backs a GPU buffer needs `-fvk-use-c-layout` ([C++ layout != std140/std430](../learnings/1783986652112-slang-c-target-struct-layout-does-not-match-std140.md)).

**`export` roots against DCE; `public` does not.** `export`→`HLSLExportModifier` adds `HLSLExportDecoration` and `KeepAliveDecoration`; `public` adds only `PublicDecoration`, so `public __extern_cpp` + `-whole-program` emits nothing ([export without entrypoint via -whole-program](../learnings/1784381336769-slang-target-hpp-cpp-export-without-entrypoint-wor.md)). A `KeepAliveDecoration` on `__extern_cpp` is necessary but insufficient: `getHLSLExports()` roots only on `HLSLExportDecoration`. The "requires an entrypoint" gate is separate; `-whole-program` is the existing answer ([LINKING-ROOT gap](../learnings/1784383334778-slang-host-target-public-vs-export-emission-asymme.md)).

**`-target hpp` on a `__extern_cpp` compute entrypoint** emits the `example`/`_Group`/`_Thread` wrappers as definitions calling an absent `_example`, because the wrapper loop in `CPPSourceEmitter::emitModuleImpl` ignores `shouldEmitOnlyHeader()` ([hpp emits wrapper bodies](../learnings/1784381106344-slang-9403-target-hpp-emits-wrapper-bodies-not-dec.md)). Guarding the loop to emit prototypes is the whole fix; no forward-decl is needed (validated with g++) ([prototypes only](../learnings/1784382795938-slang-target-hpp-compute-entrypoint-emits-wrapper-.md)).

**`-target cuh` exports only `__extern_cpp` globals and `[CudaKernel]` functions (#14033).** Header mode (PR #3938) is opt-in: `computeEmitActions` (`slang-emit-c-like.cpp:5566`) skips globals without `IRExternCppDecoration`, so a plain `[shader("compute")]` module yields a header holding only the prelude include — never worked, not a regression. Even with `__extern_cpp`, a `[shader]` entry point gets no prototype, because `emitFuncDecl` returns early for entry points (c-like:4126, an HLSL-attribute guard); `[CudaKernel]` functions are not entry points and get `__global__` prototypes. Enabling entry-point declarations would expose a stale type: CUDA varying legalization removes the `SV_DispatchThreadID` param (`legalize-varying-params.cpp:717`) but never calls `fixUpFuncType`, so the final func type keeps a 4th `BorrowInParam(Vec(UInt,3))` param while the `.cu` definition has 3, and `emitFuncDecl` would declare the wrong signature. Fix the type in the CUDA context only (the shared base also serves CPU). Workaround verified on the L40S: `[CudaKernel]` plus `__extern_cpp` on the struct and fields, then `nvcc -rdc` link of the generated `.cu` with a host `.cu` including the `.cuh`; a g++ TU cannot include the `.cuh` (prelude `__device__` at :70) [stale IRFuncType; cuh exports only __extern_cpp/[CudaKernel]](../learnings/1793295704302-cuda-entry-point-irfunctype-stays-stale-after-vary.md).

**Unused resource globals with no prelude type break `cpp`/`host-callable`/`shader-sharedlib` (#13705).** Every sized global param becomes a `GlobalParams` field (`slang-ir-collect-global-uniforms.cpp:188-276`), a binary-interface type DCE never trims, so dropping the global is never the fix. `_getResourceTypePrefix` prints HLSL names (`RaytracingAccelerationStructure`, `RasterizerOrdered*Buffer`) that `prelude/slang-cpp-types.h` never defines → "unknown type name". Fix: a prelude type of the reserved size (one pointer for RTAS, `slang-type-layout.cpp:1604`), as CUDA did with `OptixTraversableHandle` (#8411). `-emit-cpu-via-llvm` is unaffected (`slang-ir-lower-cpu-resource-types.cpp` lowers to `void*`). CPU user atomics are a documented non-feature: widening `Interlocked*` `[require]` turns E36107 into E99999 because the C++ emitter lowers only `kIROp_AtomicAdd` ([unused resource types break host-callable](../learnings/1792162041270-cpu-c-prelude-unused-resource-types-with-no-prelud.md)).

## CUDA Arch Selection: `-capability cuda_sm_NN` Is Not a Selector, and an Explicit `-Xnvrtc -arch` Skips SM Checks (#13198, #13286)

`-capability cuda_sm_NN` is not a CUDA/PTX target selector (HEAD 4233b2c, NVRTC 12.6): atoms exist only for 1_0…9_0 (`cuda_sm_7_5`/`8_6`/`10_0` → E00014), NVRTC arch is `max(NVRTC floor, requested)` (`cuda_sm_1_0` emits `sm_50` on 12.6), and `linkWithOptions()` is inert for the arch. New atoms are deferred in #12839 for serialized-ID compat ([not a usable arch selector](../learnings/1790003555136-slang-cuda-capability-cuda-sm-nn-is-not-a-usable-a.md)). The floor depends on NVRTC version (`slang-nvrtc-compiler.cpp` ~1331-1339): `compute_75` on 12.8+, `compute_50` on 12.0-12.7, `compute_35` on 11.x. `requireSMVersion` only raises the arch and the GPU CI image is CUDA 13.0.1 (`docker/linux-gpu-ci.Dockerfile:29`), so CI cannot observe an emitter raise below 7.5 (e.g. `requireSMVersion(SemanticVersion(7,0))` for 16-bit `atomicCAS` passes with or without it); a local NVRTC 12.6 does catch a missing raise. A CUDA PR whose test claims to pin such a raise should say in the test comment and description that it only works on older NVRTC [NVRTC ≥12.8 floor is compute_75](../learnings/1793305652591-nvrtc-12-8-defaults-to-compute-75-so-cuda-sm-raise.md).

Before PR #13286 Slang always appended its own `-arch`, so a user `-Xnvrtc --gpu-architecture=` doubled it ("defined more than once"). Now an explicit `-Xnvrtc -arch=` skips the derived-arch block (`slang-nvrtc-compiler.cpp:1324-1377`), the only reader of `requiredCapabilityVersions`, so no shader minimum is checked (`__cuda_sm_version`, emitter minimums such as wave match 7.0 or coopmat 8.0, `_cuda_sm_*` atoms): `__cuda_sm_version(9.0)` with `compute_75` returns rc 0, even under `-restrictive-capability-check`. A too-low target fails only when NVRTC hits an undefined intrinsic (`__match_all_sync` on compute_60), so check which side of #13286 a binary is on. Whether an override should still diagnose is open on #13198; SlangPy #1199 depends on it ([explicit -Xnvrtc -arch bypasses SM requirements](../learnings/1791190691660-slang-nvrtc-explicit-xnvrtc-arch-post-13286-bypass.md)).

To repro DownstreamArgs forwarding (#12861), never use `--gpu-architecture` as the neutral entry (it double-defines regardless of order). Use `-DFOO=1` plus a `--this-option-must-fail` sentinel: v2026.16.1 compiles [neutral, sentinel] (the bug); v2026.19 (PR #12900) fails "unrecognized option". `findEntryPointByName` returns null without `[shader("compute")]` ([DownstreamArgs repro](../learnings/1792155142006-nvrtc-downstreamargs-repro-don-t-use-gpu-architect.md)).

## groupshared-by-ref Regresses CUDA Emit While a vk-Only Inline Pass Masks It

With `groupshared` params by reference (#10641 / PR #11709), `getSharedBaseAddr`'s `__cvta_generic_to_shared(($0).m_data)` emits `((&data)).m_data` and nvrtc rejects it. SPIR-V stays green because the by-ref inlining is only in `GLSLResourceReturnFunctionInliningPass` and the emit-side unwrap went only into `slang-emit-hlsl.cpp`, not `slang-emit-cuda.cpp`. A green SPIR-V/HLSL run does not clear CUDA: `test-linux-release-gcc-x86_64-sm80`'s `tests/neural/` + `tests/cooperative-matrix/` (nvrtc + Vulkan) are the canary ([groupshared by-ref regresses CUDA](../learnings/1784741954379-groupshared-param-by-ref-regresses-cuda-emit-vk-on.md)).

## CUDA/PTX Texel-Type and Prelude Gaps (#12274–#12300)

**Silent-empty vs loud-undefined.** `Buffer<T>.Load` (#12274) hits a case-less `__target_switch` in `hlsl.meta.slang` → empty helper → no-op kernel at exit 0; grep the emitted `.cu` for the `#line` marker ([case-less __target_switch emits empty body](../learnings/1785371749664-case-less-target-switch-in-meta-slang-silently-emi.md)). Half `_Texture<T>.Load` (#12277) has a cuda case calling `tex2Dfetch_int<__half4>`, declared but never defined → loud NVRTC error ([half-texel loud undefined](../learnings/1785373293265-cuda-texture-load-half-texel-gap-loud-undefined-te.md)). Its fix `static_assert(!__isHalf<T>())` is not too broad: the prelude instantiates `tex*fetch_int<T>` for float/uint/int only, so excluding half3 would reintroduce the bug ([half3 is NOT overreach](../learnings/1785465186257-cuda-half-texture-load-fix-half3-is-not-overreach-.md)).

**`SamplerComparisonState` (#12278/#12300).** The CUDA prelude typedefs `SamplerState` but not its comparison counterpart ([no prelude typedef](../learnings/1785373084246-cuda-samplercomparisonstate-has-no-prelude-typedef.md)). `typedef SamplerComparisonStateUnused* SamplerComparisonState;` is safe because `SampleCmp` and siblings have no `cuda` case, so a call fails loudly and an unused sampler is a harmless pointer ([no-op typedef is safe](../learnings/1785445968024-cuda-samplercomparisonstate-no-op-prelude-typedef-.md)).

**`Gather` (#12276): `$TR`, not `$T0`.** `$Tn` unwraps a texture to its element type (`slang-intrinsic-expand.cpp`), so `tex2Dgather<$T0>` put a scalar into a `float4`. A `//TEST:SIMPLE: -target ptx` test is an NVRTC compile check needing no GPU ([Gather $T0 vs $TR](../learnings/1785417049714-cuda-gather-t0-vs-tr-marker-local-gpu-nvrtc-filech.md)). Coworker containers have an NVIDIA L40S ([current fact](../learnings/1792133264162-coworker-containers-have-an-nvidia-l40s-gpu-cuda-vulkan.md)); the 2026-09-28→10-16 no-GPU period was a host passthrough outage ([outage record](../learnings/1792089571497-agent-containers-have-no-gpu-since-2026-09-28-host.md)).

**`precise` on a local (#12279)** is emitted by shared `CLikeSourceEmitter::emitTempModifiers`: valid on HLSL+GLSL, invalid on CUDA/C++/Metal/WGSL. Guard at emit, not at the producer ([precise leaks to 4 C-like targets](../learnings/1785373326278-precise-local-qualifier-leaks-to-4-c-like-targets-.md)). The cluster reproduces GPU-free (Debug slangc + NVRTC 12.6).

## `static const` Array Initializers: Nested Arrays (#12635) and Bit-Exact NaN/Inf (#13909)

Before PR #12688, nested `static const int v[2][2]` fails NVRTC on `-target ptx` ("dynamic initialization is not supported for a `__device__` variable"): each row becomes a `__device__` global because `shouldFoldInstIntoUseSites` returns Never for `MakeArray`. Flat `static const int v[4]` with manual indexing compiles on v2026.14.1 — the workaround on older builds. The struct-element variant (#13107) is a different bug; see [CUDA codegen triage](misc-f0909b5-cuda-codegen-triage.md) ([flat static const arrays workaround](../learnings/1792653924634-cuda-12635-workaround-flat-static-const-arrays-com.md)).

**Bit-exact NaN and Inf in a `static const` table (#13909, PR #13927).** Each target's constant context has its own limit (master 52e29ab43, L40S):

- **CUDA:** `U32_asfloat(...)` or `slang_bit_cast` in a `__device__ static const` initializer fails with the same "dynamic initialization" error, and so does +inf, spelled `SLANG_INFINITY` = `((float)(1e+300 * 1e+300))`, not a constant expression. `__builtin_bit_cast(float, 0x7FC00001U)` compiles under nvcc/nvrtc 12.6 and reads back exact, but sNaN 0xFF800001 comes back quieted as 0xFFC00001.
- **glslang** (`-emit-spirv-via-glsl`) rejects `uintBitsToFloat(...)` in a global `const` array ("global const initializers must be constant"); a non-const `static` global works because Slang moves its initializer into `main`.
- **DXC** keeps `static const float a[2] = { asfloat(0x7FC00001u), asfloat(0xFF800001u) }` bit-exact, sNaN included (read constants from `-target dxil-asm`; no D3D needed); g++ 12 does the same for a constexpr `__builtin_bit_cast`.
- **CPU** fails outright on master: the C++ emitter writes a folded NaN as `(0.0 / 0.0)`, a double, and clang rejects the narrowing in a brace init.

Whether the bits survive depends on folding: `asfloat(lit)` is an `__intrinsic_asm` that SCCP does not fold, so GLSL/HLSL/Metal/C++ keep its bits; `bit_cast` (`kIROp_BitCast`) folds to a `FloatLit` and loses them. SCCP folds `z / z` to the build host's default NaN, negative on x86 (0xFFC00000, SPIR-V `-0x1.8p+128`), so FileCheck patterns on NaN literals must accept either sign ([NaN-from-bits constant-context limits](../learnings/1792914266658-nan-from-bits-emission-constant-context-limits-mea.md); +inf on CUDA from [-cpu test runs a synthesized CUDA lane](../learnings/1792918374217-a-cpu-compare-compute-test-also-runs-a-synthesized.md)).

## One CUDA-Illegal Entry Point Sinks Its Siblings: Guard It with `#ifndef __TARGET_CUDA__`

Slang capability-checks ALL `[shader]` entry points at module load, so one EP with typed `Buffer<T>`/`RWBuffer<T>` (E36107) fails `load_program` for siblings. `#ifndef __TARGET_CUDA__` works because the preprocessor runs before the capability check (`__TARGET_CUDA__` is a session macro, like `__TARGET_D3D12__`/`__TARGET_VULKAN__`/`__TARGET_METAL__`). Do NOT guard `StructuredBuffer`/`RWStructuredBuffer`/`ByteAddressBuffer`; they lower to real pointers and work on CUDA. This shipped as slangpy PR #1083 to unblock slang#12289's required `SlangPy Tests` check; slangpy's `ci-latest-slang.yml` checks out slangpy's default branch, so the guard had to MERGE to slangpy main before the slang PR could go green — a prerequisite, not a follow-up ([guard CUDA EPs with #ifndef __TARGET_CUDA__](../learnings/1785453604826-guard-test-only-shader-eps-from-cuda-with-ifndef-t.md)).

## `__intrinsic_asm` Markers, Prelude Vector Operators, Fast-Math Transcendentals

**`$N` reads the CALL; `$[N]` reads the carrier's OWN operands.** In `slang-intrinsic-expand.cpp`, `$N` (`:366-374`) expands against the enclosing `m_callInst`'s args, with a `SLANG_RELEASE_ASSERT` → E99997 on OOB. `$[N]` (`:868-892`) reads `m_intrinsicInst->getOperand(1+argIndex)` (the `IRGenericAsm` for statement form) unguarded → SIGSEGV. Statement-form `__intrinsic_asm "text", args;` args are read by `$[N]` and dropped by `$N`, which is why `__sizeOf<T>()` (`$[0], T`) works. A slang#12529 report claiming these operands had no reader was wrong; read the `_emitSpecial` switch, not a summary ([two marker families](../learnings/1786631581576-intrinsic-asm-has-two-marker-families-with-differe.md)).

**Templated CUDA prelude vector operators (PR #12410).** The vector types are distinct structs, so use a traits table (`SlangCudaVectorTraits<T>` with `kWidth`/`BoolVector`/`kIsIntegral`) and gate each global template on `kWidth > 0` with a hand-rolled `enable_if` (no `<type_traits>` under NVRTC); ungated, it captures `struct Foo` and scalar `int+int`. Keep `__half2` arithmetic as non-template overloads on `__hadd2` etc. so exact match keeps one `add.f16x2` and byte-identical PTX (the prelude defines `__CUDA_NO_HALF2_OPERATORS__` before `<cuda_fp16.h>`). `if constexpr` needs a template, and `__device__` lambdas need `--extended-lambda`, which NVRTC lacks. Verify with `nvcc -std=c++17`; report the win structurally (684 definitions → 21 templates + 13 overloads), not as compile time (a 33-kernel PTX sweep had 32/33 identical opcode multisets) ([SFINAE-gated vector operators](../learnings/1787075202710-cuda-prelude-templated-vector-operators-must-be-sf.md)).

**Operator typing belongs in the preludes (#13553).** PR #13562 cast `int3 >> uint3` operands to the result type in `unifyBinaryExprOperands`; maintainer jkwak-work preferred the prelude, so it closed for #13684: mixed-type `<<`/`>>` in `slang-cuda-prelude.h` and `slang-cpp-types-core.h`, plus `splatScalarOperandsOfVectorShift`, which splats a scalar to its OWN type (as Metal/WGSL `legalizeScalarOperandsToMatchComposite` does). The IR never casts the shift amount. Asking with master-build evidence for both options settled it in one round ([prelude operators + own-type splat](../learnings/1792165281967-mixed-type-vector-shifts-maintainer-preferred-prel.md)).

**Fast-math (slang#12619).** Under `-fp-mode fast` nine F32 wrappers redirect (`__sinf, __cosf, __tanf, __sincosf, __logf, __log2f, __log10f, __expf, __powf`) plus `__exp10f`. nvcc 12.6 rejects `__exp2f`, so exp2 stays `::exp2f` with atan2/asin/acos/atan/sqrt. Verify with a `__device__` harness: `nvcc -std=c++17 -c` with and without `-DSLANG_CUDA_ENABLE_FAST_MATH=1`, then `-ptx` and `grep -cE '\.approx\.'` (nvcc at `/usr/local/cuda-12.6/bin/nvcc`, 2 min) ([__exp2f does NOT exist](../learnings/1787147170237-cuda-fast-math-redirectable-transcendentals-exp2f-.md)).

**Source learnings (33):**
- [#12635 workaround: flat static const arrays compile to PTX](../learnings/1792653924634-cuda-12635-workaround-flat-static-const-arrays-com.md)
- [`-capability cuda_sm_NN` is not an arch selector (#13198); atoms deferred in #12839](../learnings/1790003555136-slang-cuda-capability-cuda-sm-nn-is-not-a-usable-a.md)
- [post-#13286 explicit `-Xnvrtc -arch` skips SM minimums (rc 0)](../learnings/1791190691660-slang-nvrtc-explicit-xnvrtc-arch-post-13286-bypass.md)
- [`-target hpp/cpp` export without entrypoint via `-whole-program`; `public` never roots](../learnings/1784381336769-slang-target-hpp-cpp-export-without-entrypoint-wor.md)
- [public-vs-export is a LINKING-ROOT gap (HLSLExportDecoration)](../learnings/1784383334778-slang-host-target-public-vs-export-emission-asymme.md)
- [`-target hpp` emits wrapper bodies for `__extern_cpp` compute EP (#9403)](../learnings/1784381106344-slang-9403-target-hpp-emits-wrapper-bodies-not-dec.md)
- [hpp fix is prototypes only (`shouldEmitOnlyHeader()`)](../learnings/1784382795938-slang-target-hpp-compute-entrypoint-emits-wrapper-.md)
- [superseded float3-layout triage; keep only the ownership rule](../learnings/1783908909248-slang-cuda-float3-loop-arithmetic-3x-slower-than-f.md)
- [#12073 swizzle re-evaluates base per component; fold-gate seam](../learnings/1783910573494-slang-c-family-swizzle-re-evaluates-base-per-compo.md)
- [read emitted code / control kernel, not layout; workaround](../learnings/1783911049805-slang-cuda-cpp-float3-rgb-swizzle-slowdown-is-base.md)
- [#12073 fix: swizzle-base fold guard](../learnings/1783939557238-slang-12073-fix-swizzle-base-fold-guard-implemente.md)
- [C++ target struct layout != std140/std430; `-fvk-use-c-layout`](../learnings/1783986652112-slang-c-target-struct-layout-does-not-match-std140.md)
- [groupshared-by-ref regresses CUDA `getSharedBaseAddr`; sm80 neural canary](../learnings/1784741954379-groupshared-param-by-ref-regresses-cuda-emit-vk-on.md)
- [#12274 case-less `__target_switch` → silent no-op PTX](../learnings/1785371749664-case-less-target-switch-in-meta-slang-silently-emi.md)
- [#12277 half texture Load → loud NVRTC undefined; `static_assert(!__isHalf<T>())`](../learnings/1785373293265-cuda-texture-load-half-texel-gap-loud-undefined-te.md)
- [#12278 `SamplerComparisonState` has no CUDA prelude typedef](../learnings/1785373084246-cuda-samplercomparisonstate-has-no-prelude-typedef.md)
- [#12279 `precise` local leaks to all 4 C-like targets](../learnings/1785373326278-precise-local-qualifier-leaks-to-4-c-like-targets-.md)
- [#12276 `Gather`: `$TR` not `$T0`; `-target ptx` tests need no GPU](../learnings/1785417049714-cuda-gather-t0-vs-tr-marker-local-gpu-nvrtc-filech.md)
- [#12278/#12300 no-op `SamplerComparisonState` typedef is safe](../learnings/1785445968024-cuda-samplercomparisonstate-no-op-prelude-typedef-.md)
- [#12277 half3 guard is NOT overreach](../learnings/1785465186257-cuda-half-texture-load-fix-half3-is-not-overreach-.md)
- [guard CUDA-illegal EPs with `#ifndef __TARGET_CUDA__`; slangpy#1083 had to merge first](../learnings/1785453604826-guard-test-only-shader-eps-from-cuda-with-ifndef-t.md)
- [`__intrinsic_asm` `$N` vs `$[N]` marker families (slang#12529)](../learnings/1786631581576-intrinsic-asm-has-two-marker-families-with-differe.md)
- [SFINAE-gated CUDA vector operator templates; `__half2` overloads (PR #12410)](../learnings/1787075202710-cuda-prelude-templated-vector-operators-must-be-sf.md)
- [fast-math: 9 F32 `__*f` + `__exp10f`; `__exp2f` does not exist (slang#12619)](../learnings/1787147170237-cuda-fast-math-redirectable-transcendentals-exp2f-.md)
- [coworker containers have an NVIDIA L40S (2026-10-16)](../learnings/1792133264162-coworker-containers-have-an-nvidia-l40s-gpu-cuda-vulkan.md)
- [unused resource types with no CPU prelude struct break host-callable (#13705)](../learnings/1792162041270-cpu-c-prelude-unused-resource-types-with-no-prelud.md)
- [DownstreamArgs repro: `-DFOO=1` + sentinel, not `--gpu-architecture` (#12861)](../learnings/1792155142006-nvrtc-downstreamargs-repro-don-t-use-gpu-architect.md)
- [mixed-type vector shifts: prelude operators + own-type splat (#13553/#13684)](../learnings/1792165281967-mixed-type-vector-shifts-maintainer-preferred-prel.md)
- [nvcc won't merge scalar `__ldg`; only vector-chunk `__ldg` gives `LDG.E.128.CONSTANT`](../learnings/1792700658146-cuda-nvcc-won-t-merge-scalar-ldg-into-wide-loads-e.md)
- [NaN-from-bits constant-context limits per target + SCCP host NaN](../learnings/1792914266658-nan-from-bits-emission-constant-context-limits-mea.md)
- [-cpu COMPARE_COMPUTE also runs a synthesized CUDA lane; `SLANG_INFINITY` not constant](../learnings/1792918374217-a-cpu-compare-compute-test-also-runs-a-synthesized.md)
- [NVRTC ≥12.8 floor compute_75; CI cannot observe SM raise below 7.5](../learnings/1793305652591-nvrtc-12-8-defaults-to-compute-75-so-cuda-sm-raise.md)
- [`-target cuh` exports only `__extern_cpp`/`[CudaKernel]`; stale IRFuncType (#14033)](../learnings/1793295704302-cuda-entry-point-irfunctype-stays-stale-after-vary.md)

_Catalog: [[wiki/index.md]]_
