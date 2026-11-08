---
title: "Slang WGSL emit: matrix-operator validity and storage orientation, template-list ambiguity, buffer-element gaps, enable/requires directives, push constants, and GPU-free naga/Tint validation"
type: concept
group: slang-backends
tags: [wgsl, naga, naga-wasm, tint, dawn, webgpu-node, validation, var-immediate, push-constant, matrix-layout, subgroups, matrix, negation, int64, legalizeMatrixTypes, template-list, emit, bool, host-shareable, lower-buffer-element-type, std140, VectorReshape, peephole, enable, primitive_index, subgroups, capability-atoms, compat-mode, static-samplers, interpolate, slang]
source_count: 30
---

# Slang WGSL emit: matrix-operator validity and storage orientation, template-list ambiguity, buffer-element gaps, enable/requires directives, push constants, and GPU-free naga/Tint validation

Slang's WGSL emitter (`slang-emit-wgsl.cpp`) can produce rc-0 text that naga or Tint rejects, all checkable without a GPU. Related: [[wiki/concepts/slang-backends-wgsl-metal.md]], [[wiki/concepts/slang-backends-f0909b0-glsl-wgsl-bindless.md]], [WGSL f16 and const-expressions](slang-backends-wgsl-f16-and-const-expressions.md), [DescriptorHandle emit and bindless targets](slang-backends-descriptor-handle-emit-and-bindless-targets.md).

## TL;DR

- **GPU-free validators:** naga-wasm is cheapest; real Tint is `webgpu@0.6.2` `backend=null` with `shader-f16`/`subgroups` requested; wgpu-py adds pipeline, dispatch and `override` checks. Containers lack real slang-tint and slang-test ignores `-wgpu` rows, so FileCheck never proves WGSL valid.
- **naga and Tint have different blind spots; use Tint for f16, subgroups, uniformity, const-expressions, 64-bit integers, missing `enable`s and new directives.** Name the validator that ran.
- **Tint's `lower.cc` defines a WGSL built-in's cross-target meaning**: `workgroupUniformLoad(p)` is barrier; load; barrier, and Slang's other arms drop the barriers (#13631).
- **Template-list ambiguity (§3.9):** in `f(a < b, a > b)` the `a <` opens a template list a later `>` closes; Slang leaves relational args bare (#13566).
- **No unary `-` on WGSL matrices and no scalar matrix constructor**: emit `T(-1) * m` (keeps -0) or `matCxR<T>() - m`; scalar `uint` `- x` is rejected too (#13571), and vector `vecN<T>(0) - x` drops -0 (#14179).
- **Non-float matrices are lowered on WGPU since #13572**; E38203 fires only where `validateVectorsAndMatrices` sees the vector (#14188), and a test built from int64 scalars is vacuous.
- **`bool` in `var<uniform>`/`var<storage>` is not host-shareable (#13590)**: three coupled buffer-element-lowering gaps, fixed together.
- **A bare WGSL expression statement usually means a null-typed IR inst** (#13607). **rc 0 is not validity**: when a PR turns an ICE into rc 0, validate other shapes too; undefined resources give invalid GLSL/WGSL, and `-fvk-use-c-layout` and kin split WGSL entry-point uniforms from reflection (#13704).
- **The WGSL varying legalizer cannot request enables** (`primitive_index`; `subgroups` for a raw `SV_WaveLaneIndex`); draft #13619's `SystemValueInfo.requiredWGSLExtension` is the hook to stack them on.
- **`subgroups_f16` no longer exists** (removed Apr 2025), yet Slang emits it whenever `half` meets a subgroup op (#13636). Tint also checks directive order.
- **Check gpuweb and Dawn before adding a WGSL capability atom**: multisampled array textures are core, static samplers API-side, compat mode device validation. capdef has no subtraction, so a restricted profile is a base atom the full profile implies.
- **WGSL push constants are `var<immediate>`** (module scope, no binding, no arrays), emitted since #13646; blocks with an array, matrix or `bool` member still fail Tint because buffer matrices become `_MatrixStorage_*` arrays (open #13666).
- **A native WGSL `matRxC` in a buffer is Slang `row_major` byte for byte**; `column_major` (slangc CLI default) is its transpose (`matCxR` plus `transpose()`).

## Validating WGSL in-container: naga-wasm, wgpu-py and real Tint

**naga-wasm** (`npm install naga-wasm@30.2.0`; node 22 works despite a >=24.12 warning) is the cheapest oracle and the source of every naga message here: `validate(parseWgsl(src))` throws on any error ([naga-wasm via npm](../learnings/1791663423398-gpu-free-wgsl-parse-validate-check-naga-wasm-via-n.md)). Containers carry only a 15 KB `slang-tint` stub, so `-target wgsl-spirv-asm` fails (E00100/E52002) and slang-test ignores `-wgpu` COMPARE_COMPUTE and `wgsl-spirv-asm` rows.

**wgpu-py** is the pip-only naga route, adding pipeline and GPU-value checks. In a venv (`pip install wgpu numpy`; system pip is PEP-668 locked; `export XDG_RUNTIME_DIR=/tmp`), `request_device_sync(required_features=feats)` then `create_shader_module(code=src)` raises naga's error with a span; pass every feature the module `enable`s (e.g. `clip_distances`, #14130). A compute pipeline's `"constants": {"0": 7}` sets `@id(0) override` values; on #14285 naga's "Unexpected override-expression" caught a `const` over an `override` that FileCheck passed (cause on [[wiki/concepts/slang-backends-wgsl-f16-and-const-expressions.md]]). Runners: `/workspace/agent/tools/wgsl-run.py <file.wgsl> <num_i32_words> [groups] [id=value]`, slang-reviewer's `runs/probe-14285/run_wgsl.py` ([pip wgpu in a venv](../learnings/1793759506242-validate-wgsl-locally-without-dawn-tint-pip-instal.md), [wgpu-py when Tint/Dawn are absent](../learnings/1793757469039-validate-and-run-slang-wgsl-output-locally-with-wg.md)). Pipeline creation catches bad `var<uniform>` layouts, dispatch plus `read_buffer` checks values, and a vertex-only render pipeline (needs `depth_stencil` and vertex buffers matching the `@location`s) exposed dropped explicit locations (GLSL 0/3 → WGSL 1/0, ~#9693). naga enforces §11.4 pointer address-space matching, confirming the `__constref` bugs #13703/#13709: a `static` global argument emits `&(var<private>)` into a `ptr<function>` parameter (the #12173 family on [[wiki/concepts/slang-backends-wgsl-metal.md]]), and a `groupshared` one a rejected `ptr<workgroup>` parameter ([wgpu-py on the GPU](../learnings/1793222265902-validate-emitted-wgsl-on-the-gpu-with-wgpu-py-naga.md)).

**Trust the setup before the verdict.** A slang-tint stub (`scratch-13391/libslang-tint.so`) only captures WGSL for a real validator. Compare a binary's mtime with the merge you reproduce: on 2026-10-31 Release slangc predated #14097 while Debug had it ([no real slang-tint; binary mtime](../learnings/1793437270685-validate-emitted-wgsl-on-the-gpu-with-pip-wgpu-nag.md)). An older mtime proves a binary stale, but a newer one does not prove it fresh (one linked after HEAD's commit time was still 289 build steps behind), so run the incremental build before citing a sha [slangc mtime and -version are NOT freshness signals — rebuild before claiming "reproduced on master <sha>"](../learnings/1794103854670-slangc-mtime-and-version-are-not-freshness-signals.md). A worktree's `build/Release` can hold a since-reverted prototype (wt-14179); compare `libslang-compiler.so`'s mtime with the source or compile a distinguishing probe ([naga accepts i64/u64; stale worktree binaries](../learnings/1793627059479-wgsl-validity-checks-naga-accepts-i64-u64-use-tint.md)). Check any validator once with a known-bad snippet (`bitcast<bool>(u32)` gives "Unable to cast") and a known-good one ([self-check the validator](../learnings/1793614821483-wgsl-validation-without-tint-dawn-wgpu-py-naga-on-.md)).

**naga is wrong in both directions on recent WGSL.** It rejects the spec-listed f16 bitcasts `bitcast<vec2<f16>>(u32)`/`bitcast<u32>(vec2<f16>)` ([naga rejects f16 bitcasts](../learnings/1792085330619-naga-wasm-rejects-spec-valid-wgsl-f16-bitcasts-val.md)), every `enable subgroups;` ([naga cannot validate `enable subgroups;`](../learnings/1792070896998-wgsl-subgroups-f16-is-dead-naga-wasm-30-cannot-val.md)), and `requires immediate_address_space;` while accepting `var<immediate>` itself ([naga 30.2 `var<immediate>` gap](../learnings/1792071495705-wgsl-var-immediate-push-constants-spec-rules-naga-.md)). It accepts `i64`/`u64` via its 64-bit extension, which Tint rejects ("unresolved type 'i64'"); the Dawn harness can crash on valid input, so trust its errors and confirm valid forms with naga ([naga accepts i64/u64](../learnings/1793627059479-wgsl-validity-checks-naga-accepts-i64-u64-use-tint.md)). naga also skips uniformity, misses Tint-only errors (NaN/Inf const-expressions, module-scope user-function calls), rejects `--x` (Tint accepts it), and accepts subgroup `@builtin`s with no `enable subgroups;`.

**Real Tint runs in the container through Dawn's null backend** (`npm install webgpu@0.6.2`, ~137 MB; `XDG_RUNTIME_DIR=/tmp`):

```js
import { create, globals } from "webgpu"; Object.assign(globalThis, globals);
const gpu = create(["backend=null"]);
const dev = await (await gpu.requestAdapter()).requestDevice({ requiredFeatures: ["shader-f16", "subgroups"] });
const m = dev.createShaderModule({ code });
console.log((await m.getCompilationInfo()).messages); process.exit(0);
```

The null adapter reports Chrome's features, language features and limits (`maxImmediateSize=64`); without `process.exit(0)` it may hang. Unlike naga it accepts `requires immediate_address_space;` and runs uniformity analysis ("'subgroupAdd' must only be called from subgroup uniform control flow") ([real Tint via node webgpu](../learnings/1792074422249-gpu-free-real-tint-wgsl-validation-via-node-webgpu.md)); `create(["backend=vulkan"])` runs the same check on the L40S ([enable checks: use Tint](../learnings/1793961570931-wgsl-enable-extension-checks-use-tint-dawn-node-no.md)). The triager's `tools/tint-validate/tint-validate.mjs` requests no features, so every `enable f16;` fails ("extension 'f16' is not allowed"); `var x : u16` is a good negative control ([tint-validate.mjs rejects all f16](../learnings/1792085503561-tint-validate-mjs-rejects-all-f16-wgsl-unless-the-.md)). From C, slang-rhi's prebuilt Dawn reaches it (`WGPUBackendType_Null`; slang-fixer `reports/tint-wgsl-validator.c`); with `-wgpu` rows "Not Supported" on llvmpipe and slang-tint fetched only for Windows x64, this is the local Tint oracle ([PackedFloat never reaches the FloatLit switch](../learnings/1792099072974-slang-packedfloat-types-bf16-fp8-never-reach-the-w.md)).

Tint facts measured this way: a function `@diagnostic` does not cover callees; conflicting severities for one rule are an error; an unknown rule only warns; `derivative_uniformity` and `subgroup_uniformity` are independent; directives must precede every global declaration, which Slang's insertion-ordered helper preludes can violate (a `diagnostic(...)` prelude after `fn _slang_getNan()`).

**Spec and Tint sources without a browser.** Tint's extension list is the `enum extension` block of `src/tint/lang/wgsl/wgsl.def`. Other Dawn files: `curl -sL "https://dawn.googlesource.com/dawn/+/refs/heads/main/<path>?format=TEXT" | base64 -d`; commits via `+/<sha>?format=JSON` minus the `)]}'` prefix (`gh api repos/google/dawn` 401s). The spec: `curl -sL https://gpuweb.github.io/gpuweb/wgsl/` (w3.org 429s) ([subgroups_f16 is dead](../learnings/1792070896998-wgsl-subgroups-f16-is-dead-naga-wasm-30-cannot-val.md), [Tint's lowering is the reference](../learnings/1792071135841-wgsl-built-in-semantics-use-tint-s-lowering-as-the.md)).

## Template-list ambiguity in comma-separated argument lists (#13566)

`vec2<bool>(a_0 < b_0, a_0 > b_0)` fails naga ("expected `)`, found b_0") under §3.9, because Slang emits call and constructor arguments at `EmitOp::General`, where `maybeEmitParens` leaves relational operators bare. Source parens and locals get folded away; only a list with no `<` followed by `>` works ([same](../learnings/1791663423398-gpu-free-wgsl-parse-validate-check-naga-wasm-via-n.md)). Testing fix #13569 needs inputs reaching each comma-list path: `Flags f = { a < b, a > b };` lowers to the synthesized constructor call `Flags_x24init_0(...)`, not `kIROp_MakeStruct` (see [[wiki/concepts/slang-language-core-struct-construction-lowering.md]]), and vector `(u <= v) && (u >= v)` on `float2` lowers to `select(vec2<bool>(false), rhs, lhs)`. On the emit side, wrap `defaultEmitInstExpr(inst, getInfo(EmitOp::General))` in parens as Metal's MakeArray does ([`{a, b}` lowers to a ctor call](../learnings/1791675327416-slang-a-b-initializer-list-on-wgsl-lowers-to-a-syn.md)).

## Matrix negation: `T(0) - m` is not WGSL (#13571)

`WGSLSourceEmitter::tryEmitInstExprImpl`'s `kIROp_Neg` case lowers vectors and matrices to `(T(0) - x)`; `vecN<T>(0)` is a valid splat, but `matCxR<T>(0)` is not ("cannot cast a {AbstractInt} to a mat2x2<f32>"). The form came from #7936 mirroring Metal (valid MSL); releases up to 2025.12 emitted the equally invalid `- mat2x2(...)`, so it is no regression. Use `(f32(-1) * m)` (keeps -0) or `mat2x2<f32>() - m`. 32-bit int/uint/bool matrices are unaffected (`legalizeMatrixTypes` makes them arrays of row vectors), and matrix-plus-scalar splats via `MakeMatrixFromScalar`. Scalar `uint` negation emits `- x`, also rejected ("Operation Negate can't work") ([use `T(-1) * m`](../learnings/1791749878369-wgsl-emitter-matrix-negation-t-0-m-is-invalid-use-.md)). The vector form drops the sign of zero (#14179); probes, fix shape and the `isSignedType` half gap are on [WGSL vector negation and signed zero](slang-backends-wgsl-vector-negation-signed-zero.md).

## 64-bit integer matrices reach the emitter as `IRMatrixType` (#13572)

`shouldLowerMatrixType` (slang-ir-legalize-matrix-types.cpp) lowered only bool/int/uint for WGSL, so int64/uint64 matrices compiled with rc 0 to `mat2x2<i64>(...)` ("matrix scalar type must be floating-point"), even for `m + m`; int16/uint16 give E56103, int8 and double ICE. An emitter `isFloatingType(matrixElt)` assert was reachable, and Release `SLANG_ASSERT` is `SLANG_ASSUME` (UB). `int64_t2x2(buf[0],...)` gave E38203, while `matrix<int64_t,2,2>(b[0],...)` with a `float2x2(-m)` consumer compiled ([int64 matrices survive legalizeMatrixTypes](../learnings/1791763584478-wgsl-int64-uint64-matrices-survive-legalizematrixt.md)).

The fix lowers every non-float matrix on WGPU (`return !isFloatingType(elementType)`), so the 32-bit vector-width check in `slang-ir-validate.cpp` reports E38203. A test matrix built from int64 scalars is vacuous (AST lowering already makes an int64 vector, so E38203 fires unfixed too); `matrix<int64_t,2,2>(floatMat)` is not, but its diagnostic has no location, so annotations are caret-less. Run every new negative row against the unfixed build ([a matrix-lowering diagnostic test can be vacuous](../learnings/1791809366702-slang-wgsl-a-diagnostic-test-for-matrix-lowering-c.md)). The check stays shape-dependent on master 6815ed82d: `validateVectorsAndMatrices` runs before `legalizeMatrixTypes` (which since #14022 lowers integer matrices to vectors), so int64 `m + m` stored to a buffer emits `vec2<i64>` silently while `m[0][0]` gets E38203 (#14188) ([naga accepts i64/u64](../learnings/1793627059479-wgsl-validity-checks-naga-accepts-i64-u64-use-tint.md)).

## Buffer-element lowering: `bool` is not host-shareable (#13590)

`struct P { bool b; bool a[2]; }; ConstantBuffer<P> gC;` or `StructuredBuffer<bool2>` on `-target wgsl` emits `bool` in `var<uniform>`/`var<storage>` with rc 0; naga and Tint report "not host-shareable". Three coupled gaps in `slang-ir-lower-buffer-element-type.cpp` cause it, none sufficient alone:

1. The only bool→int leaf mapping is Khronos-only (`KhronosTargetBufferElementTypeLoweringPolicy::lowerLeafLogicalType`); WGSL uses `WGSLBufferElementTypeLoweringPolicy`.
2. WGSL std140 array-element widening in `getLoweredTypeInfoImpl` overwrites the leaf's `convertLoweredToOriginal` with `VectorReshape`, so `bool[N]` and bool matrices use a `u32` as an `if` condition; reshape and cast must be composed.
3. `needsElementLowering` accepts scalar `bool` but not top-level `vector<bool,N>` (which also fails spirv-val on SPIR-V).

An 88-line prototype of all three passed 14/16 shapes in naga, reflection unchanged; left are `ByteAddressBuffer` (#10207) and push constants ([bool in buffers: 3 coupled gaps](../learnings/1791890303067-wgsl-bool-in-uniform-storage-buffers-3-coupled-gap.md)).

## A null-typed `VectorReshape` swizzle prints as a dangling statement (#13607)

The same std140 widening causes the next silent failure:

```slang
struct S { float a[3]; };
ConstantBuffer<S> gC;
RWStructuredBuffer<S> gOut;
gOut[0].a = gC.a;   // invalid WGSL on master
// gOut[0] = gC;    // invalid WGSL once #13607 fixes the CopyLogical ICE
```

Unpacking a std140-widened scalar-array element uses `kIROp_VectorReshape`; `slang-ir-peephole.cpp` folds vector→scalar into `builder.emitSwizzle(as<IRVectorType>(inst->getDataType()), …)`, null for a scalar result, so the swizzle prints as a bare `….data_0[i32(N)].x;` and a later use names an undeclared `_S1`. The fix is `emitSwizzle(inst->getDataType(), …)`, tested by `tests/wgsl/uniform-array-copy-to-storage.slang` ([typeless swizzle](../learnings/1791921698811-vectorreshape-scalar-peephole-emits-a-typeless-swi.md), [null result type](../learnings/1791924339218-slang-peephole-vectorreshape-to-scalar-swizzle-was.md)). #13607 turned a master ICE (cross-layout `CopyLogical`, [[wiki/concepts/slang-backends-f0909b0-spirv-legalization-crashes.md]]) into rc 0; probing only `bool` missed the float arrays that then hit this peephole.

## rc 0 with invalid output: undefined resources and entry-point uniform layout (#13700, #13704)

For an undefined resource value (`LoadFromUninitializedMemory`/`Poison`, e.g. a `Texture2D` local unset on some path), GLSL prints an undeclared identifier because `shouldFoldInstIntoUseSites` folds resources before the never-fold-undefined check; WGSL declares a function-scope `var t : texture_2d<f32>`, which Tint rejects ("must have constructible type"). `checkUnsupportedInst` rejects only an opaque `DefaultConstruct`, so neither case is diagnosed, with or without #13700. Validate with `-emit-spirv-via-glsl` and the Tint harness, using `int` cbuffer conditions so #13590 does not fail first. A related hang needs no texture: a `{undef, self}` phi or swap cycle (`int t; for(..){ if(c==i){int r; t=r;} o[i]=t; }`) hangs slangc on SPIR-V/HLSL; #13700's `arg == inst` skip fixes it ([undefined resources hide invalid output](../learnings/1792155974717-slang-glsl-wgsl-compiles-checks-hide-invalid-outpu.md)). In #13704, `slang-ir-entry-point-uniforms.cpp:559` sets the synthesized entry-point CB's layout from `-force-glsl-scalar-layout`/`-fvk-use-c-layout` with no target check, so WGSL lowering honours it while reflection stays std140 and host and shader offsets disagree; `-fvk-use-dx-layout` also breaks WGSL uniforms ([wgpu-py is a pip-installable validator](../learnings/1792162080215-wgpu-py-naga-is-a-pip-installable-real-wgsl-valida.md)).

## Required `enable`/`requires` directives: missing, stale, and misplaced (#13617, #13636)

**Missing.** `@builtin(primitive_index)` (fragment-only `u32`) needs `enable primitive_index;` and the "primitive-index" feature since naga 29 / Chrome 142. Slang marks `SV_PrimitiveID` unsupported on WGSL (E55202) in `LegalizeWGSLEntryPointContext::getSystemValueInfo` (slang-ir-legalize-varying-params.cpp), whose `SystemValueInfo` has no required-extension field. The producer-side hook is that field plus `legalizeSystemValue` calling `addRequireWGSLExtensionDecoration`; the emitter's `emitFrontMatterImpl` (run after the body) already writes `enable X;`. Likewise a raw `uint l : SV_WaveLaneIndex` parameter emits `@builtin(subgroup_invocation_id)` without `enable subgroups;`: only Wave* intrinsics call `__requireTargetExtension("subgroups")`, and the varying legalizer attaches no extension. Tint rejects the omission ("...requires enabling extension 'subgroups'", likewise `subgroup_size`/`subgroup_id`); naga 30.x accepts it. Still unfixed at master 6d43c8d88; filed as shader-slang/slang#14383 ([primitive_index needs an enable](../learnings/1791954062918-wgsl-primitive-index-needs-enable-primitive-index-.md), [enable checks: use Tint](../learnings/1793961570931-wgsl-enable-extension-checks-use-tint-dawn-node-no.md)). Draft #13619 adds it as `SystemValueInfo.requiredWGSLExtension`; `barycentric_coord`/`view_index` enables stack on it ([check gpuweb first](../learnings/1792916916093-wgsl-chromium-experimental-features-check-gpuweb-b.md)).

**Stale and misplaced.** Dawn/Tint removed the `subgroups_f16` enable and feature in April 2025 (dawn e2c7a2a0b8; absent from WGSL §4.1.1 and `wgsl.def`), but Slang's `handleRequiredCapabilitiesImpl` (#6213) still emits it, so any `half` plus any subgroup op, even on `uint`, gives a module Tint rejects (#13636) ([subgroups_f16 is dead](../learnings/1792070896998-wgsl-subgroups-f16-is-dead-naga-wasm-30-cannot-val.md)). WGSL's `requires X;` must also precede all declarations, and `ShaderExtensionTracker::appendExtensionRequireLinesForWGSL` emits only `enable X;` today ([`var<immediate>` spec rules](../learnings/1792071495705-wgsl-var-immediate-push-constants-spec-rules-naga-.md)).

**Where a feature lives decides how to model it.** A Dawn-experimental feature may already be standard: gpuweb#6283 (June 2026) put `texture_multisampled_2d_array` into core with no `enable`, leaving only the `static_assert` in `__wgsl_check_texture_type` (hlsl.meta.slang:1339); barycentrics are a discussion (gpuweb#5566). Check gpuweb before adding a `wgsl_chromium_experimental_*` atom in the #13707 pattern (#13932) ([check gpuweb first](../learnings/1792916916093-wgsl-chromium-experimental-features-check-gpuweb-b.md)). Dawn "static samplers" are API-side (`StaticSamplerBindingLayout`); the shader declares a normal `sampler`, which Slang already emits. WebGPU compatibility mode has no directive either: it is device validation (featureLevel "compatibility") plus limits (`maxStorageBuffersInVertexStage` defaults to 0). capdef is only `+`/`|`, so a restricted profile inverts the chain (as `_spirv_1_x` does): a compat base atom, a core atom implying it, features gated on core. Compat accepts only `@interpolate(flat, either)`, but Slang's `nointerpolation` emits `@interpolate(flat)`. Unfiled: a lone `sample`/`centroid` qualifier is dropped, as `emitInterpolationModifiersImpl` emits `@interpolate` only with an interpolation type (#13933) ([static samplers are API-side](../learnings/1792917188690-webgpu-dawn-static-samplers-are-api-side-compat-mo.md)).

## WGSL built-in semantics: Tint's lowering is the cross-target reference (#13631)

When a Slang intrinsic mirrors a WGSL built-in, Tint's `src/tint/lang/wgsl/reader/lower/lower.cc` defines its meaning on other backends: `workgroupUniformLoad(p)` becomes `workgroupBarrier(); load (or atomicLoad); workgroupBarrier()`. Slang's `hlsl.meta.slang` `default: return v;` drops both barriers on SPIR-V, HLSL, GLSL, Metal and CUDA (DeepWiki echoed the bug as design) ([Tint's lowering is the reference](../learnings/1792071135841-wgsl-built-in-semantics-use-tint-s-lowering-as-the.md)).

## Push constants: WGSL `var<immediate>` (#13639, #13646)

`var<immediate>` (`immediate_address_space`) is module-scope and binding-less, uses storage layout, needs a host-shareable constructible type with no arrays (even nested), and at most one is statically accessed per entry point (API `setImmediates`). Before #13646, `emitParameterGroupImpl` hard-coded a binding-less, invalid `var<uniform>` for push constants (#13639) ([`var<immediate>` spec rules](../learnings/1792071495705-wgsl-var-immediate-push-constants-spec-rules-naga-.md)). The no-arrays rule collides with buffer matrix lowering: `shouldLowerMatrixType` (slang-ir-lower-buffer-element-type.cpp) keeps a matrix native only under the Natural layout, which WGSL never uses, so every WGSL buffer matrix (push constants arrive as `AddressSpace::Uniform`) becomes a `_MatrixStorage_*` array struct ([matrix storage orientation](../learnings/1792086860208-wgsl-matrix-storage-native-matrxc-slang-row-major-.md)). Since #13715 the wrapper also covers int/uint/bool matrices (not bare `vector<T,C>[R]` arrays). #13646 (merged 2026-10-21) emits `var<immediate>`, but on master 0bd71cd70 a block with an array, matrix or `bool` member still fails Tint ("arrays cannot be used in the <immediate> address space"); scalar/vector blocks pass. The lowering is design question #13666, awaiting maintainers ([still rejects arrays/matrices after #13646](../learnings/1792685555616-wgsl-var-immediate-still-rejects-arrays-matrices-a.md)).

## Matrix storage orientation: native `matRxC` is Slang row-major (#13666)

Slang emits an HLSL-semantics `floatRxC` as WGSL `matRxC` (the "terminology reversal" in slang-emit-wgsl.cpp), so each WGSL column holds one Slang row and a native matrix in a std430/storage/immediate buffer matches Slang `row_major` byte for byte; `column_major` is the transpose, needing `matCxR` plus `transpose()` and a different size (`float3x4`: 64 vs 48 bytes). Column-major is the slangc CLI default and row-major the API default, so a keep-matrices-native fix must handle both ([matrix storage orientation](../learnings/1792086860208-wgsl-matrix-storage-native-matrxc-slang-row-major-.md)). GLSL input follows the same default: a std430 SSBO `mat4` is read row-major on SPIR-V and WGSL, the GLSL target emits `layout(row_major) buffer;`, and `-matrix-layout-row-major` gives GLSL column-major semantics ([same wgpu-py run](../learnings/1793222265902-validate-emitted-wgsl-on-the-gpu-with-wgpu-py-naga.md)).

**Source learnings (30):**
- [naga-wasm via npm](../learnings/1791663423398-gpu-free-wgsl-parse-validate-check-naga-wasm-via-n.md)
- [`{a, b}` on WGSL lowers to a synthesized ctor call](../learnings/1791675327416-slang-a-b-initializer-list-on-wgsl-lowers-to-a-syn.md)
- [Matrix negation: use `T(-1) * m`](../learnings/1791749878369-wgsl-emitter-matrix-negation-t-0-m-is-invalid-use-.md)
- [int64 matrices survive legalizeMatrixTypes](../learnings/1791763584478-wgsl-int64-uint64-matrices-survive-legalizematrixt.md)
- [Matrix-lowering diagnostic test can be vacuous](../learnings/1791809366702-slang-wgsl-a-diagnostic-test-for-matrix-lowering-c.md)
- [bool in buffers: 3 coupled gaps](../learnings/1791890303067-wgsl-bool-in-uniform-storage-buffers-3-coupled-gap.md)
- [VectorReshape peephole: typeless swizzle](../learnings/1791921698811-vectorreshape-scalar-peephole-emits-a-typeless-swi.md)
- [VectorReshape swizzle: null result type](../learnings/1791924339218-slang-peephole-vectorreshape-to-scalar-swizzle-was.md)
- [primitive_index needs an enable](../learnings/1791954062918-wgsl-primitive-index-needs-enable-primitive-index-.md)
- [`subgroups_f16` is dead](../learnings/1792070896998-wgsl-subgroups-f16-is-dead-naga-wasm-30-cannot-val.md)
- [Tint's lowering is the cross-target reference](../learnings/1792071135841-wgsl-built-in-semantics-use-tint-s-lowering-as-the.md)
- [`var<immediate>` spec rules; naga gap](../learnings/1792071495705-wgsl-var-immediate-push-constants-spec-rules-naga-.md)
- [`var<immediate>` still rejects arrays after #13646](../learnings/1792685555616-wgsl-var-immediate-still-rejects-arrays-matrices-a.md)
- [Real Tint via node webgpu null backend](../learnings/1792074422249-gpu-free-real-tint-wgsl-validation-via-node-webgpu.md)
- [naga rejects valid f16 bitcasts](../learnings/1792085330619-naga-wasm-rejects-spec-valid-wgsl-f16-bitcasts-val.md)
- [tint-validate.mjs needs shader-f16](../learnings/1792085503561-tint-validate-mjs-rejects-all-f16-wgsl-unless-the-.md)
- [Native matRxC is Slang row-major](../learnings/1792086860208-wgsl-matrix-storage-native-matrxc-slang-row-major-.md)
- [Linux-ignored Tint rows](../learnings/1792099072974-slang-packedfloat-types-bf16-fp8-never-reach-the-w.md)
- [wgpu-py is a pip-installable validator](../learnings/1792162080215-wgpu-py-naga-is-a-pip-installable-real-wgsl-valida.md)
- [wgpu-py on the GPU: pipeline/value checks](../learnings/1793222265902-validate-emitted-wgsl-on-the-gpu-with-wgpu-py-naga.md)
- [No real slang-tint; check binary mtime](../learnings/1793437270685-validate-emitted-wgsl-on-the-gpu-with-pip-wgpu-nag.md)
- [Undefined resources hide invalid output](../learnings/1792155974717-slang-glsl-wgsl-compiles-checks-hide-invalid-outpu.md)
- [Check gpuweb before a chromium_* atom](../learnings/1792916916093-wgsl-chromium-experimental-features-check-gpuweb-b.md)
- [Static samplers; compat mode](../learnings/1792917188690-webgpu-dawn-static-samplers-are-api-side-compat-mo.md)
- [Validator self-check](../learnings/1793614821483-wgsl-validation-without-tint-dawn-wgpu-py-naga-on-.md)
- [naga accepts i64; stale worktree binaries](../learnings/1793627059479-wgsl-validity-checks-naga-accepts-i64-u64-use-tint.md)
- [pip wgpu in a venv; `override` constants](../learnings/1793759506242-validate-wgsl-locally-without-dawn-tint-pip-instal.md)
- [wgpu-py run helper; `XDG_RUNTIME_DIR`](../learnings/1793757469039-validate-and-run-slang-wgsl-output-locally-with-wg.md)
- [Enable checks: Tint, not naga (#14383)](../learnings/1793961570931-wgsl-enable-extension-checks-use-tint-dawn-node-no.md)
- [a newer mtime does not prove a binary fresh; build before citing a sha](../learnings/1794103854670-slangc-mtime-and-version-are-not-freshness-signals.md)

_Catalog: [[wiki/index.md]]_
