---
title: "Slang CUDA & CPU/C++ Backends: C-Family Emitter Codegen"
type: concept
group: slang-backends
tags: [cuda, cpp, c-family-emitter, swizzle, float3, codegen-perf, nvrtc, slang-12073, ldg, immutable-load, vectorized-load, static-const, nan, bit-cast, restrict, ImmutablePtr, ldg-pointer]
source_count: 35
---

# Slang CUDA & CPU/C++ Backends: C-Family Emitter Codegen

The CUDA and CPU/C++ targets share one code path — `CPPSourceEmitter` (`source/slang/slang-emit-cpp.cpp`), which `CUDASourceEmitter` inherits (`slang-emit-cuda.h:44`). This "C-family emitter" is distinct from the SPIR-V and HLSL paths, and its lowering choices produce target asymmetries, including a real performance bug.

## TL;DR

- **CUDA and CPU/C++ are one emitter, so a C-family emit bug is never CUDA-only.** Scope any finding to both targets.
- **A multi-component swizzle READ re-emits a folded base once per component** (`float3{ base.x, base.y, base.z }`): the swizzle is ONE IR use that expands to N textual references, so the fold guard misses it.
- **The trigger is a non-trivial folded base** (texture fetch, helper call, `saturate(...)`), not the vector type; a local-base repro is not a repro, and `float3`'s 12-byte layout is a red herring. Values are always correct.
- **Confirm emit duplication GPU-free by counting occurrences:** emit `-target cuda`/`cpp` and `grep -o tex2Dfetch | wc -l` (`grep -c` says 1). `SLANGPY_PRINT_GENERATED_SHADERS=1` dumps the SlangPy wrapper, not emitted CUDA.
- **User workaround:** bind the fetch to a named local and write lanes by assignment; `float4(shade(uv).rgb, a)` calls `shade` 3×.
- **SlangPy does not vendor Slang**, so a CUDA vector-math bug in the user's `.slang` is an upstream `shader-slang/slang` issue.
- **`-target cpp` struct layout is C natural alignment (`CPULayoutRulesImpl`)**; pair a GPU-shared struct with `-fvk-use-c-layout`.
- **`export` roots a host-callable function against DCE; `public` does not** (`getHLSLExports()` checks `HLSLExportDecoration`, never `KeepAlive`). In `-dump-ir`, "appears once then vanishes" is a link drop; "persists to the final module" is an emit-filter drop.
- **`-target hpp` for a `__extern_cpp` compute entrypoint emits wrapper BODIES** calling an absent workhorse; emit prototypes only when `shouldEmitOnlyHeader()`.
- **`-target cuh` exports only `__extern_cpp` globals and `[CudaKernel]` functions;** a `[shader]` entry point gets no prototype, and its `IRFuncType` stays stale after CUDA varying legalization (no `fixUpFuncType`).
- **An unused global of a resource type with no CPU prelude struct breaks `host-callable`;** `GlobalParams` fields are never DCE'd, so add a correctly sized prelude type.
- **`-capability cuda_sm_NN` is not an arch selector** (atoms 1_0–9_0, a max() floor). After #13286 an explicit `-Xnvrtc -arch` skips every SM-minimum check. NVRTC's floor is `compute_75` on 12.8+, so CI (CUDA 13.0.1) cannot observe an SM raise below 7.5.
- **A green SPIR-V/HLSL run does not clear CUDA for a param-passing change.** Groupshared-by-ref breaks `getSharedBaseAddr`'s `($0).m_data`; the sm80 `tests/neural/` + `tests/cooperative-matrix/` jobs are the canary.
- **Case-less `__target_switch` → silent empty kernel (PTX `ret;`, exit 0); case-present + un-instantiated prelude template → loud NVRTC "referenced but not defined".** Do not dedup them.
- **A "make-it-a-no-op" prelude typedef is safe only if the type's methods have no target case** for that backend.
- **Use `$TR` when an intrinsic needs the result type;** `$T<n>` unwraps a texture to its element type. **`$N` reads the call's args (guarded, E99997); `$[N]` reads the carrier's own operands (unguarded, SIGSEGV).**
- **`precise` on a local leaks to all four C-like targets** via shared `emitTempModifiers`; gate at emit.
- **Before narrowing a guard called too broad, check whether the extra inputs are also broken** (half3 texture `Load` is too).
- **One CUDA-illegal entry point sinks its clean siblings;** wrap it in `#ifndef __TARGET_CUDA__`. Never guard structured/byte-address buffers.
- **A `-target ptx` test is an NVRTC compile check, not a GPU run.** Containers have an L40S anyway (`nvidia-smi -L`).
- **Editing `hlsl.meta.slang` requires the core-module-header regen** before `slangc` shows the change.
- **Global templated CUDA vector operators must be SFINAE-gated** to registered vector types; keep `__half2` intrinsics as non-template overloads. Verify with `nvcc -std=c++17`.
- **CPU/CUDA operator typing belongs in the preludes, not in IR casts** (#13684).
- **Bit-exact NaN/Inf in a CUDA `__device__ static const` table needs `__builtin_bit_cast(float, 0x...U)`;** `U32_asfloat`, `slang_bit_cast`, `SLANG_INFINITY` are not constant expressions. `asfloat(lit)` keeps its bits (SCCP doesn't fold it); `bit_cast` folds and loses them; SCCP's NaN takes the host's sign.
- **`__exp2f` does not exist,** so F32 exp2 stays precise under `-fp-mode fast`.
- **nvcc never merges scalar `__ldg` into wide loads, even with `__builtin_assume_aligned`;** a wide read-only-cached load must be emitted as vector-chunk `__ldg((const uint4*)p)`.
- **For `__restrict__` on a read-only CUDA source, point users at `ImmutablePtr<T>`** (lowers to `__ldg`, same SASS and time). The real gap is non-overlapping read-write buffers. Pointer-valued loads never get `__ldg`, and `.CONSTANT` on them measured no faster.

## The float3/swizzle-base re-evaluation perf bug (slang#12073, from slangpy#1059)

**Symptom:** a hot loop reading `.rgb`/`.xyz` runs ~3× slower on CUDA (2.87× on L40S/NVRTC 13) than reading a whole `float4` or named scalars; Vulkan/D3D12 show no penalty, values are correct.

**Root cause.** `CPPSourceEmitter`'s `kIROp_Swizzle` handler (`slang-emit-cpp.cpp:1642-1719`) lowers a multi-component READ to `float3{ base.x, base.y, base.z }`, calling `emitOperand(getBase())` per component. When `shouldFoldInstIntoUseSites` (`slang-emit-c-like.cpp:1685-1687`) folds the base into its use it is duplicated N×; the guard refuses only on >1 IR uses. Fetch counts: `f4_all`=1, `f3_loop`=**3**, `f3_epi`=1. SPIR-V (`OpVectorShuffle`) and HLSL (`.xyz`) evaluate once ([swizzle re-evaluates base](../learnings/1783910573494-slang-c-family-swizzle-re-evaluates-base-per-compo.md)). The `f3_epi` control (`.rgb` of a local) emits one fetch, so only a non-trivial folded base is slow ([re-evaluation, not layout](../learnings/1783910857099-float3-vec3-cuda-slowdown-is-swizzle-base-re-evalu.md)).

**Fix (draft PR #12078).** The `CPPSourceEmitter::shouldFoldInstIntoUseSites` override (`slang-emit-cpp.cpp:1931-1970`) already refuses to fold a vector/matrix used by a reshape/cast; the fix adds `IRSwizzle` users with `getElementCount() > 1`, making the base a temp (`f3_loop` → 1 fetch) ([fold guard](../learnings/1783939557238-slang-12073-fix-swizzle-base-fold-guard-implemente.md)). **Workaround:** `float4 s = tex[q];` then read `s.r/s.g/s.b`, and `v.a = a; dst[tid] = v;` instead of a constructor-swizzle ([workaround](../learnings/1783911049805-slang-cuda-cpp-float3-rgb-swizzle-slowdown-is-base.md)).

**Superseded:** the first triage blamed `float3`'s 12/4 layout and called it CUDA-only ([layout triage](../learnings/1783908909248-slang-cuda-float3-loop-arithmetic-3x-slower-than-f.md)); emitted-`.cu` inspection on CUDA **and** C++ plus `f3_epi` falsified both. Its ownership rule stands (SlangPy doesn't vendor Slang). Confirm with `slangc repro.slang -target cuda -entry <e> -stage compute -o k.cu` and an occurrence count; count operations in emitted code before recording a mechanism. Unrelated to Metal PR #10031 packed-vec3.

## Read-Only Loads: `__ldg`, `ImmutablePtr`, and `__restrict__` (#13877, #14138, #14144)

**nvcc never merges scalar `__ldg` into wide loads.** For a 32-byte, 16-aligned `{ float[3], uint[3], float[2] }` from immutable memory, Slang emits one `__ldg` per field (nvcc 12.6, `-O3`, sm_89, PTX + `cuobjdump -sass`):

| Emitted form | Result |
|---|---|
| Scalar `__ldg` per field + `__builtin_assume_aligned(p,16)` | 8× `ld.global.nc` / `LDG.E.CONSTANT` |
| Plain struct copy via `const T* __restrict__`, same hint | 2× `LDG.E.128`, but `.nc`/`.CONSTANT` lost |
| Plain struct copy, no hint | 8× `LDG.E.CONSTANT` |
| Explicit `__ldg((const uint4*)p)` / `(const float4*)` chunks | 2× `ld.global.nc.v4` / `LDG.E.128.CONSTANT` |

So honoring `IRAlignedAttr` in `emitImmutableLoad` (`slang-ir-cuda-immutable-load.cpp`) means widest aligned vector-chunk `__ldg` plus bit-cast reassembly; on master CUDA ignores `IRAlignedAttr` (only SPIR-V `Aligned N` and LLVM use it). The per-element split comes from `deferBufferLoad` (`slang-ir-defer-buffer-load.cpp`), `lowerImmutableBufferLoadForCUDA::createLoadFuncForType` (`slang-ir-cuda-immutable-load.cpp:107`) and `createArrayUnpackFunc` (`slang-ir-lower-buffer-element-type.cpp:527`). SASS check: `nvcc -cubin -arch=sm_89 -O3 -I<slang>/prelude x.cu && cuobjdump -sass x.cubin | grep -oE 'LDG[.A-Z0-9]*' | sort | uniq -c` ([scalar __ldg not merged](../learnings/1792700658146-cuda-nvcc-won-t-merge-scalar-ldg-into-wide-loads-e.md)). The `__constant__` launch-parameter guard is on [[wiki/concepts/misc-f0909b5-cuda-codegen-triage.md]].

**`ImmutablePtr<T>` already gives `__restrict__` SASS (#14138).** Slang emits no `__restrict__`: the declarator prints a bare `*`, `restrict` on a pointer param is E31206 (gate near `slang-check-decl.cpp:15166`, TextureType only), and `[vk_restrict_pointer]`/`[vk_aliased_pointer]` (`hlsl.meta.slang` ~28825) lack `__attributeTarget`, so E31002 fires and they are inert; LLVM sets `noalias` only on out/borrow params. On the L40S (nvcc 12.6, sm_89, 6815ed82d) a 57-float record copy to 3 outputs took 2.08 ms; a hand `__restrict__` batched loads as `LDG.E.CONSTANT` at 1.54 ms; `uniform ImmutablePtr<Rec>` alone gave identical SASS and 1.54 ms, also via NVRTC `-target ptx`. The real gap is non-overlapping read-write buffers ([ImmutablePtr ≈ restrict](../learnings/1793544112009-cuda-restrict-gap-immutableptr-t-already-gives-res.md)).

**Pointer values never get `__ldg`; `.CONSTANT` is not a speedup by default (#14144).** `createLoadFuncForType` (`:107-297`) has no `kIROp_PtrType` case, and struct/array cases are all-or-nothing (:285-289), so one pointer field cancels `__ldg` for the whole struct. Hand-patching `slang_bit_cast<float*>(__ldg((const unsigned long long*)&p))` gives `LDG.E.64.CONSTANT`, but a pointer-chase on the L40S was not faster (load-only 107.7 ms either way; with stores 65–71 ms as-is vs 108 ms `.nc`, 70 ms bit-cast control, 107 ms nvcc `__restrict__`), so measure before selling `__ldg` coverage as perf. Separately, a top-level `ImmutablePtr<float3x3>`/`StructuredBuffer<float3x3>` load misses `__ldg`: `lowerBufferElementTypeToStorageType` wraps it in a `[ForceInline] unpackStorage(RefParam)`, and `lowerImmutableBufferLoadForCUDA` (`slang-emit.cpp:2721`) runs before `performForceInlining` (:2724); nested matrices are fine. Recipe: `-dump-ir-before lowerImmutableBufferLoadForCUDA`, `nvcc -cubin -arch=sm_89`, `cuobjdump -sass | grep LDG` / `-res-usage`, time with a driver-API host (`cuModuleLoad` + `cuLaunchKernel` + events) ([pointer __ldg no speedup](../learnings/1793565659951-cuda-ldg-on-pointer-values-sass-gets-constant-but-.md)).

## CPU/C++ Host Targets: Struct Layout, `-target hpp`/`cpp` Rooting, Header-Only Prototypes (#9401/#9403), `-target cuh` (#14033)

`-target cpp` uses `CPULayoutRulesImpl` natural alignment; a struct also backing a GPU buffer needs `-fvk-use-c-layout` ([C++ layout != std140](../learnings/1783986652112-slang-c-target-struct-layout-does-not-match-std140.md)).

**`export` roots against DCE; `public` does not.** `export`→`HLSLExportModifier` adds `HLSLExportDecoration` + `KeepAliveDecoration`; `public` adds only `PublicDecoration`, so `public __extern_cpp` + `-whole-program` emits nothing ([export via -whole-program](../learnings/1784381336769-slang-target-hpp-cpp-export-without-entrypoint-wor.md)). `KeepAliveDecoration` is insufficient because `getHLSLExports()` roots only on `HLSLExportDecoration`; the "requires an entrypoint" gate is separate and `-whole-program` answers it ([LINKING-ROOT gap](../learnings/1784383334778-slang-host-target-public-vs-export-emission-asymme.md)).

**`-target hpp` on a `__extern_cpp` compute entrypoint** emits `example`/`_Group`/`_Thread` wrapper definitions calling an absent `_example`, because the wrapper loop in `CPPSourceEmitter::emitModuleImpl` ignores `shouldEmitOnlyHeader()` ([wrapper bodies](../learnings/1784381106344-slang-9403-target-hpp-emits-wrapper-bodies-not-dec.md)); guarding it to emit prototypes is the whole fix (validated with g++) ([prototypes only](../learnings/1784382795938-slang-target-hpp-compute-entrypoint-emits-wrapper-.md)).

**`-target cuh` (#14033).** Header mode (PR #3938) is opt-in: `computeEmitActions` (`slang-emit-c-like.cpp:5566`) skips globals without `IRExternCppDecoration`, so a plain `[shader("compute")]` module yields only the prelude include (never worked). `emitFuncDecl` returns early for entry points (c-like:4126), so `[shader]` gets no prototype; `[CudaKernel]` functions get `__global__` prototypes. Enabling EP declarations would expose a stale type: varying legalization removes `SV_DispatchThreadID` (`legalize-varying-params.cpp:717`) without `fixUpFuncType`, leaving a 4th `BorrowInParam(Vec(UInt,3))` param vs 3 in the `.cu`. Fix in the CUDA context only (the base also serves CPU). Workaround (L40S): `[CudaKernel]` + `__extern_cpp` on the struct and fields, `nvcc -rdc` link with a host `.cu` including the `.cuh`; g++ cannot include it (prelude `__device__` at :70) [stale IRFuncType](../learnings/1793295704302-cuda-entry-point-irfunctype-stays-stale-after-vary.md).

**Unused resource globals with no prelude type break `cpp`/`host-callable`/`shader-sharedlib` (#13705).** Every sized global param becomes a `GlobalParams` field (`slang-ir-collect-global-uniforms.cpp:188-276`) that DCE never trims; `_getResourceTypePrefix` prints HLSL names (`RaytracingAccelerationStructure`, `RasterizerOrdered*Buffer`) missing from `prelude/slang-cpp-types.h`. Fix: a prelude type of the reserved size (one pointer for RTAS, `slang-type-layout.cpp:1604`), as CUDA did with `OptixTraversableHandle` (#8411). `-emit-cpu-via-llvm` lowers to `void*` and is unaffected. CPU user atomics are a documented non-feature: widening `Interlocked*` `[require]` turns E36107 into E99999 (only `kIROp_AtomicAdd` is lowered) ([unused resource types](../learnings/1792162041270-cpu-c-prelude-unused-resource-types-with-no-prelud.md)).

## CUDA Arch Selection: `-capability cuda_sm_NN` Is Not a Selector, and an Explicit `-Xnvrtc -arch` Skips SM Checks (#13198, #13286)

Atoms exist only for 1_0…9_0 (`cuda_sm_7_5`/`8_6`/`10_0` → E00014), NVRTC arch is `max(floor, requested)` (`cuda_sm_1_0` emits `sm_50` on 12.6), and `linkWithOptions()` is inert for arch; new atoms are deferred in #12839 for serialized-ID compat ([not an arch selector](../learnings/1790003555136-slang-cuda-capability-cuda-sm-nn-is-not-a-usable-a.md)). The floor (`slang-nvrtc-compiler.cpp` ~1331-1339) is `compute_75` on 12.8+, `compute_50` on 12.0-12.7, `compute_35` on 11.x. `requireSMVersion` only raises, and GPU CI is CUDA 13.0.1 (`docker/linux-gpu-ci.Dockerfile:29`), so CI cannot observe a raise below 7.5 (16-bit `atomicCAS`'s `requireSMVersion(SemanticVersion(7,0))` passes either way); local NVRTC 12.6 does. A test claiming to pin such a raise should say it only works on older NVRTC [NVRTC ≥12.8 floor](../learnings/1793305652591-nvrtc-12-8-defaults-to-compute-75-so-cuda-sm-raise.md).

Before PR #13286 Slang always appended `-arch`, so a user `-Xnvrtc --gpu-architecture=` was "defined more than once". Now an explicit `-Xnvrtc -arch=` skips the derived-arch block (`slang-nvrtc-compiler.cpp:1324-1377`), the only reader of `requiredCapabilityVersions`, so no minimum is checked (`__cuda_sm_version(9.0)` with `compute_75` → rc 0, even with `-restrictive-capability-check`); a too-low target fails only on an undefined intrinsic (`__match_all_sync` on compute_60). Whether an override should diagnose is open on #13198; SlangPy #1199 depends on it ([-Xnvrtc -arch bypass](../learnings/1791190691660-slang-nvrtc-explicit-xnvrtc-arch-post-13286-bypass.md)). To repro DownstreamArgs forwarding (#12861) don't use `--gpu-architecture`; use `-DFOO=1` plus a `--this-option-must-fail` sentinel (v2026.16.1 compiles = bug; v2026.19/PR #12900 fails "unrecognized option"); `findEntryPointByName` needs `[shader("compute")]` ([DownstreamArgs repro](../learnings/1792155142006-nvrtc-downstreamargs-repro-don-t-use-gpu-architect.md)).

## groupshared-by-ref Regresses CUDA Emit While a vk-Only Inline Pass Masks It

With `groupshared` params by reference (#10641 / PR #11709), `getSharedBaseAddr`'s `__cvta_generic_to_shared(($0).m_data)` emits `((&data)).m_data`, which nvrtc rejects. SPIR-V stays green because the by-ref inlining is only in `GLSLResourceReturnFunctionInliningPass` and the unwrap only in `slang-emit-hlsl.cpp`. `test-linux-release-gcc-x86_64-sm80`'s `tests/neural/` + `tests/cooperative-matrix/` are the canary; grep neural/coopmat `__intrinsic_asm` bodies for `$0` `.member` derefs first ([groupshared by-ref](../learnings/1784741954379-groupshared-param-by-ref-regresses-cuda-emit-vk-on.md)).

## CUDA/PTX Texel-Type and Prelude Gaps (#12274–#12300)

**Silent-empty vs loud-undefined.** `Buffer<T>.Load` (#12274) hits a case-less `__target_switch` → empty helper → no-op kernel at exit 0; grep the `.cu` for the `#line` marker ([case-less switch](../learnings/1785371749664-case-less-target-switch-in-meta-slang-silently-emi.md)). Half `_Texture<T>.Load` (#12277) calls `tex2Dfetch_int<__half4>`, declared but never defined → loud NVRTC error ([half texel](../learnings/1785373293265-cuda-texture-load-half-texel-gap-loud-undefined-te.md)); `static_assert(!__isHalf<T>())` is not too broad, since the prelude instantiates `tex*fetch_int<T>` only for float/uint/int ([half3 not overreach](../learnings/1785465186257-cuda-half-texture-load-fix-half3-is-not-overreach-.md)).

**`SamplerComparisonState` (#12278/#12300)** has no CUDA prelude typedef ([no typedef](../learnings/1785373084246-cuda-samplercomparisonstate-has-no-prelude-typedef.md)); `typedef SamplerComparisonStateUnused* SamplerComparisonState;` is safe because `SampleCmp` etc. have no `cuda` case ([no-op typedef safe](../learnings/1785445968024-cuda-samplercomparisonstate-no-op-prelude-typedef-.md)).

**`Gather` (#12276): `$TR`, not `$T0`** — `$Tn` unwraps a texture to its element type (`slang-intrinsic-expand.cpp`), so `tex2Dgather<$T0>` put a scalar into a `float4`; a `//TEST:SIMPLE: -target ptx` test needs no GPU ([Gather $TR](../learnings/1785417049714-cuda-gather-t0-vs-tr-marker-local-gpu-nvrtc-filech.md)). Coworker containers have an L40S ([current fact](../learnings/1792133264162-coworker-containers-have-an-nvidia-l40s-gpu-cuda-vulkan.md)); 2026-09-28→10-16 was a passthrough outage ([outage record](../learnings/1792089571497-agent-containers-have-no-gpu-since-2026-09-28-host.md)).

**`precise` on a local (#12279)** comes from shared `CLikeSourceEmitter::emitTempModifiers`: valid on HLSL/GLSL, invalid on CUDA/C++/Metal/WGSL; guard at emit ([precise leaks](../learnings/1785373326278-precise-local-qualifier-leaks-to-4-c-like-targets-.md)). The cluster reproduces GPU-free (Debug slangc + NVRTC 12.6).

## `static const` Array Initializers: Nested Arrays (#12635) and Bit-Exact NaN/Inf (#13909)

Before PR #12688, nested `static const int v[2][2]` fails NVRTC ("dynamic initialization is not supported for a `__device__` variable") because `shouldFoldInstIntoUseSites` returns Never for `MakeArray`; flat `static const int v[4]` compiles on v2026.14.1 (the workaround). The struct-element variant (#13107) is on [CUDA codegen triage](misc-f0909b5-cuda-codegen-triage.md) ([flat arrays workaround](../learnings/1792653924634-cuda-12635-workaround-flat-static-const-arrays-com.md)).

**Bit-exact NaN/Inf (#13909, PR #13927)**, per target (master 52e29ab43, L40S):

- **CUDA:** `U32_asfloat`/`slang_bit_cast` in a `__device__ static const` hits "dynamic initialization", as does `SLANG_INFINITY` = `((float)(1e+300 * 1e+300))`. `__builtin_bit_cast(float, 0x7FC00001U)` works (nvcc/nvrtc 12.6), but sNaN 0xFF800001 reads back quieted 0xFFC00001.
- **glslang** (`-emit-spirv-via-glsl`) rejects `uintBitsToFloat` in a global `const` array; a non-const `static` works (initializer moved into `main`).
- **DXC** keeps `asfloat(0x7FC00001u)`/`asfloat(0xFF800001u)` bit-exact (read `-target dxil-asm`); g++ 12 likewise for constexpr `__builtin_bit_cast`.
- **CPU** fails on master: a folded NaN is emitted as `(0.0 / 0.0)`, a double, and clang rejects the brace-init narrowing.

`asfloat(lit)` is an `__intrinsic_asm` SCCP doesn't fold, so GLSL/HLSL/Metal/C++ keep its bits; `bit_cast` (`kIROp_BitCast`) folds to a `FloatLit` and loses them. SCCP folds `z / z` to the host NaN, negative on x86 (0xFFC00000, SPIR-V `-0x1.8p+128`), so NaN FileCheck patterns must accept either sign ([NaN-from-bits limits](../learnings/1792914266658-nan-from-bits-emission-constant-context-limits-mea.md); +inf on CUDA from [-cpu test runs a CUDA lane](../learnings/1792918374217-a-cpu-compare-compute-test-also-runs-a-synthesized.md)).

## One CUDA-Illegal Entry Point Sinks Its Siblings: Guard It with `#ifndef __TARGET_CUDA__`

Slang capability-checks ALL `[shader]` entry points at load, so one EP with typed `Buffer<T>`/`RWBuffer<T>` (E36107) fails `load_program` for siblings. `#ifndef __TARGET_CUDA__` works because the preprocessor runs first (a session macro like `__TARGET_D3D12__`/`__TARGET_VULKAN__`/`__TARGET_METAL__`). Don't guard `StructuredBuffer`/`RWStructuredBuffer`/`ByteAddressBuffer` (real pointers on CUDA). Shipped as slangpy PR #1083 for slang#12289's required `SlangPy Tests`; slangpy's `ci-latest-slang.yml` checks out slangpy main, so the guard had to MERGE first — a prerequisite, not a follow-up ([#ifndef __TARGET_CUDA__](../learnings/1785453604826-guard-test-only-shader-eps-from-cuda-with-ifndef-t.md)).

## `__intrinsic_asm` Markers, Prelude Vector Operators, Fast-Math Transcendentals

**`$N` reads the CALL; `$[N]` reads the carrier's OWN operands.** In `slang-intrinsic-expand.cpp`, `$N` (`:366-374`) uses `m_callInst`'s args with a `SLANG_RELEASE_ASSERT` → E99997 on OOB; `$[N]` (`:868-892`) reads `m_intrinsicInst->getOperand(1+argIndex)` unguarded → SIGSEGV. Statement-form `__intrinsic_asm "text", args;` args are read by `$[N]` and dropped by `$N` (why `__sizeOf<T>()` = `$[0], T` works). A slang#12529 claim that these had no reader was wrong; read the `_emitSpecial` switch ([two marker families](../learnings/1786631581576-intrinsic-asm-has-two-marker-families-with-differe.md)).

**Templated CUDA prelude vector operators (PR #12410).** Use a traits table (`SlangCudaVectorTraits<T>`: `kWidth`/`BoolVector`/`kIsIntegral`) and gate each global template on `kWidth > 0` with a hand-rolled `enable_if` (no `<type_traits>` in NVRTC); ungated, it captures `struct Foo` and `int+int`. Keep `__half2` arithmetic as non-template overloads on `__hadd2` etc. for one `add.f16x2` and byte-identical PTX (`__CUDA_NO_HALF2_OPERATORS__` precedes `<cuda_fp16.h>`). `if constexpr` needs a template; `__device__` lambdas need `--extended-lambda` (not in NVRTC). Report the win structurally (684 definitions → 21 templates + 13 overloads), not compile time (32/33 kernels identical) ([SFINAE-gated operators](../learnings/1787075202710-cuda-prelude-templated-vector-operators-must-be-sf.md)).

**Operator typing belongs in the preludes (#13553).** PR #13562 cast `int3 >> uint3` operands in `unifyBinaryExprOperands`; jkwak-work preferred the prelude, landing #13684: mixed-type `<<`/`>>` in `slang-cuda-prelude.h` and `slang-cpp-types-core.h` plus `splatScalarOperandsOfVectorShift`, which splats a scalar to its OWN type (like Metal/WGSL `legalizeScalarOperandsToMatchComposite`). Master-build evidence for both options settled it in one round ([prelude operators](../learnings/1792165281967-mixed-type-vector-shifts-maintainer-preferred-prel.md)).

**Fast-math (slang#12619).** `-fp-mode fast` redirects nine F32 wrappers (`__sinf, __cosf, __tanf, __sincosf, __logf, __log2f, __log10f, __expf, __powf`) plus `__exp10f`; nvcc 12.6 rejects `__exp2f`, so exp2 stays `::exp2f` with atan2/asin/acos/atan/sqrt. Verify with a `__device__` harness: `nvcc -std=c++17 -c` with/without `-DSLANG_CUDA_ENABLE_FAST_MATH=1`, then `-ptx` and `grep -cE '\.approx\.'` (`/usr/local/cuda-12.6/bin/nvcc`) ([__exp2f does not exist](../learnings/1787147170237-cuda-fast-math-redirectable-transcendentals-exp2f-.md)).

**Source learnings (35):**
- [#12635 workaround: flat static const arrays compile to PTX](../learnings/1792653924634-cuda-12635-workaround-flat-static-const-arrays-com.md)
- [`-capability cuda_sm_NN` is not an arch selector (#13198)](../learnings/1790003555136-slang-cuda-capability-cuda-sm-nn-is-not-a-usable-a.md)
- [post-#13286 explicit `-Xnvrtc -arch` skips SM minimums](../learnings/1791190691660-slang-nvrtc-explicit-xnvrtc-arch-post-13286-bypass.md)
- [`-target hpp/cpp` export without entrypoint via `-whole-program`](../learnings/1784381336769-slang-target-hpp-cpp-export-without-entrypoint-wor.md)
- [public-vs-export is a LINKING-ROOT gap](../learnings/1784383334778-slang-host-target-public-vs-export-emission-asymme.md)
- [`-target hpp` emits wrapper bodies (#9403)](../learnings/1784381106344-slang-9403-target-hpp-emits-wrapper-bodies-not-dec.md)
- [hpp fix is prototypes only](../learnings/1784382795938-slang-target-hpp-compute-entrypoint-emits-wrapper-.md)
- [superseded float3-layout triage; ownership rule](../learnings/1783908909248-slang-cuda-float3-loop-arithmetic-3x-slower-than-f.md)
- [#12073 swizzle re-evaluates base per component](../learnings/1783910573494-slang-c-family-swizzle-re-evaluates-base-per-compo.md)
- [read emitted code / control kernel; workaround](../learnings/1783911049805-slang-cuda-cpp-float3-rgb-swizzle-slowdown-is-base.md)
- [#12073 fix: swizzle-base fold guard](../learnings/1783939557238-slang-12073-fix-swizzle-base-fold-guard-implemente.md)
- [C++ struct layout != std140/std430](../learnings/1783986652112-slang-c-target-struct-layout-does-not-match-std140.md)
- [groupshared-by-ref regresses CUDA; sm80 canary](../learnings/1784741954379-groupshared-param-by-ref-regresses-cuda-emit-vk-on.md)
- [#12274 case-less `__target_switch` → silent no-op](../learnings/1785371749664-case-less-target-switch-in-meta-slang-silently-emi.md)
- [#12277 half texture Load → loud NVRTC undefined](../learnings/1785373293265-cuda-texture-load-half-texel-gap-loud-undefined-te.md)
- [#12278 `SamplerComparisonState` has no prelude typedef](../learnings/1785373084246-cuda-samplercomparisonstate-has-no-prelude-typedef.md)
- [#12279 `precise` leaks to 4 C-like targets](../learnings/1785373326278-precise-local-qualifier-leaks-to-4-c-like-targets-.md)
- [#12276 `Gather`: `$TR` not `$T0`](../learnings/1785417049714-cuda-gather-t0-vs-tr-marker-local-gpu-nvrtc-filech.md)
- [#12278/#12300 no-op typedef is safe](../learnings/1785445968024-cuda-samplercomparisonstate-no-op-prelude-typedef-.md)
- [#12277 half3 guard is NOT overreach](../learnings/1785465186257-cuda-half-texture-load-fix-half3-is-not-overreach-.md)
- [guard CUDA-illegal EPs with `#ifndef __TARGET_CUDA__`](../learnings/1785453604826-guard-test-only-shader-eps-from-cuda-with-ifndef-t.md)
- [`$N` vs `$[N]` marker families (slang#12529)](../learnings/1786631581576-intrinsic-asm-has-two-marker-families-with-differe.md)
- [SFINAE-gated vector operator templates (PR #12410)](../learnings/1787075202710-cuda-prelude-templated-vector-operators-must-be-sf.md)
- [fast-math: `__exp2f` does not exist (slang#12619)](../learnings/1787147170237-cuda-fast-math-redirectable-transcendentals-exp2f-.md)
- [coworker containers have an NVIDIA L40S](../learnings/1792133264162-coworker-containers-have-an-nvidia-l40s-gpu-cuda-vulkan.md)
- [unused resource types break host-callable (#13705)](../learnings/1792162041270-cpu-c-prelude-unused-resource-types-with-no-prelud.md)
- [DownstreamArgs repro: sentinel, not `--gpu-architecture` (#12861)](../learnings/1792155142006-nvrtc-downstreamargs-repro-don-t-use-gpu-architect.md)
- [mixed-type vector shifts: prelude operators (#13684)](../learnings/1792165281967-mixed-type-vector-shifts-maintainer-preferred-prel.md)
- [nvcc won't merge scalar `__ldg`](../learnings/1792700658146-cuda-nvcc-won-t-merge-scalar-ldg-into-wide-loads-e.md)
- [`ImmutablePtr<T>` gives `__restrict__`-equivalent SASS (#14138)](../learnings/1793544112009-cuda-restrict-gap-immutableptr-t-already-gives-res.md) — 2.08 → 1.54 ms; E31206/E31002.
- [`__ldg` on pointer values: no speedup; matrix loads miss `__ldg` (#14144)](../learnings/1793565659951-cuda-ldg-on-pointer-values-sass-gets-constant-but-.md) — no `kIROp_PtrType` case; pass order.
- [NaN-from-bits constant-context limits per target](../learnings/1792914266658-nan-from-bits-emission-constant-context-limits-mea.md)
- [-cpu COMPARE_COMPUTE also runs a synthesized CUDA lane](../learnings/1792918374217-a-cpu-compare-compute-test-also-runs-a-synthesized.md)
- [NVRTC ≥12.8 floor compute_75](../learnings/1793305652591-nvrtc-12-8-defaults-to-compute-75-so-cuda-sm-raise.md)
- [`-target cuh` exports only `__extern_cpp`/`[CudaKernel]`; stale IRFuncType](../learnings/1793295704302-cuda-entry-point-irfunctype-stays-stale-after-vary.md)

_Catalog: [[wiki/index.md]]_
